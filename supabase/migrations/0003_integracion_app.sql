-- Integración de la app con Supabase: datos de usuario, versión de empresa y visibilidad del jefe.
-- Ejecutar completo en Supabase > SQL Editor.

alter table perfiles
  add column if not exists email text,
  add column if not exists usuario text,
  add column if not exists rol_app text,                       -- cargo fino: cont_gerente, rrhh_auxiliar, ...
  add column if not exists ia_permitida boolean not null default false,
  add column if not exists debe_cambiar_clave boolean not null default false;

update perfiles p set email = u.email, usuario = coalesce(p.usuario, u.email)
from auth.users u where u.id = p.id and p.email is null;
update perfiles set rol_app = 'superadmin' where rol = 'superadmin' and rol_app is null;

-- Versión por empresa: evita que dos personas se sobrescriban sin enterarse.
alter table empresas add column if not exists version int not null default 1;
create or replace function toca_actualizado() returns trigger language plpgsql as $$
begin new.actualizado = now(); new.version = old.version + 1; return new; end $$;

-- Quién es mi administrador (para que el personal vea su licencia y su estado).
create or replace function mi_admin() returns uuid
language sql stable security definer set search_path = public as $$
  select admin_id from perfiles where id = auth.uid()
$$;

drop policy if exists perfiles_ver on perfiles;
create policy perfiles_ver on perfiles for select to authenticated using (
  id = auth.uid() or admin_id = auth.uid() or id = mi_admin() or es_superadmin());

drop policy if exists licencias_ver on licencias;
create policy licencias_ver on licencias for select to authenticated using (
  admin_id = auth.uid() or admin_id = mi_admin() or es_superadmin());

-- La licencia solo vale si la cuenta del administrador no está bloqueada.
create or replace function licencia_vigente(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from licencias l join perfiles p on p.id = l.admin_id
    where l.admin_id = a and p.activo and l.estado = 'activa'
      and (l.vence is null or l.vence >= current_date))
$$;

-- Cada quien marca que ya cambió su clave inicial.
create or replace function clave_cambiada() returns void
language sql security definer set search_path = public as $$
  update perfiles set debe_cambiar_clave = false where id = auth.uid()
$$;
grant execute on function clave_cambiada() to authenticated;
