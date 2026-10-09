-- Propietario: el dueño de una empresa cliente. Tiene acceso completo a SUS empresas (como cualquier miembro, por
-- acceso_empresa) y gestiona a su personal desde la app (la creación de cuentas la valida app/api/usuarios/route.js).
-- Esto le deja VER, en la lista de usuarios, al personal de sus empresas y sus asignaciones.
-- Ejecutar completo en Supabase > SQL Editor (una sola vez).

-- ¿Quien inició sesión es Propietario (activo) de esta empresa?
create or replace function es_propietario_de(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from miembros m join perfiles p on p.id = m.user_id
    where m.empresa_id = e and m.user_id = auth.uid() and p.rol_app = 'propietario' and p.activo)
$$;

-- Asignaciones: además de las propias, el propietario ve las de sus empresas.
drop policy if exists miembros_ver on miembros;
create policy miembros_ver on miembros for select to authenticated using (
  user_id = auth.uid() or es_superadmin()
  or exists(select 1 from empresas e where e.id = empresa_id and e.admin_id = auth.uid())
  or es_propietario_de(empresa_id));

-- Perfiles: además de lo que ya veía cada quien, el propietario ve al personal asignado a sus empresas.
create or replace function es_personal_de_mis_empresas(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from miembros m where m.user_id = u and es_propietario_de(m.empresa_id))
$$;
drop policy if exists perfiles_ver on perfiles;
create policy perfiles_ver on perfiles for select to authenticated using (
  id = auth.uid() or admin_id = auth.uid() or id = mi_admin() or es_superadmin()
  or es_personal_de_mis_empresas(id));

grant execute on function es_propietario_de(uuid), es_personal_de_mis_empresas(uuid) to authenticated;
