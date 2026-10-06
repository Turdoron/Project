-- TINBREW Contable: esquema multi-cliente con seguridad por fila (RLS).
-- Jerarquía: superadmin > administrador (cliente) > empresas > empleados (miembros).
-- Decisiones: el superadmin puede LEER los datos de todas las empresas (no editarlos);
-- cobro manual por tramos de empresas; la app siempre requiere conexión.
-- Ejecutar completo en Supabase > SQL Editor.

create type rol_usuario as enum ('superadmin','administrador','empleado');

create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  rol rol_usuario not null default 'empleado',
  admin_id uuid references perfiles(id),         -- empleado: administrador que lo contrata
  activo boolean not null default true,
  creado timestamptz not null default now()
);

-- Tarifas por tramo de cantidad de empresas (Quetzales por MES).
create table tarifas (
  desde_empresas int primary key,
  hasta_empresas int,                            -- null = sin tope
  precio_gtq numeric(10,2) not null,
  periodo text not null default 'mensual'
);
insert into tarifas (desde_empresas,hasta_empresas,precio_gtq) values (1,10,300),(11,20,500),(21,50,1000),(51,null,1500);

-- Licencia de cada administrador. El superadmin la activa, renueva o suspende a mano.
create table licencias (
  admin_id uuid primary key references perfiles(id) on delete cascade,
  estado text not null default 'activa' check (estado in ('activa','suspendida')),
  vence date,
  max_empresas int not null default 10,          -- el tramo contratado (10, 20, 50, ...)
  max_usuarios int not null default 10
);

create table empresas (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references perfiles(id) on delete cascade,
  nombre text not null,
  datos jsonb not null default '{}'::jsonb,      -- mismo JSON de la app actual, por ahora
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index on empresas(admin_id);

create table miembros (
  empresa_id uuid not null references empresas(id) on delete cascade,
  user_id uuid not null references perfiles(id) on delete cascade,
  depto text not null default 'contabilidad',
  permisos jsonb not null default '{}'::jsonb,
  primary key (empresa_id, user_id)
);
create index on miembros(user_id);

create table bitacora (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  user_id uuid references perfiles(id) on delete set null,
  empresa_id uuid references empresas(id) on delete set null,
  accion text not null,
  detalle jsonb
);

-- ---------- Funciones auxiliares (security definer evita recursión de RLS) ----------
create function es_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from perfiles where id = auth.uid() and rol = 'superadmin' and activo)
$$;

create function licencia_vigente(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from licencias
    where admin_id = a and estado = 'activa' and (vence is null or vence >= current_date))
$$;

-- Dueño o miembro activo de la empresa, con licencia vigente.
create function acceso_empresa(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from empresas em
    where em.id = e and licencia_vigente(em.admin_id)
      and (em.admin_id = auth.uid()
           or exists(select 1 from miembros m join perfiles p on p.id = m.user_id
                     where m.empresa_id = e and m.user_id = auth.uid() and p.activo))
  )
$$;

-- ---------- RLS ----------
alter table perfiles  enable row level security;
alter table licencias enable row level security;
alter table empresas  enable row level security;
alter table miembros  enable row level security;
alter table bitacora  enable row level security;
alter table tarifas   enable row level security;

create policy tarifas_ver on tarifas for select to authenticated using (true);
create policy tarifas_super on tarifas for all to authenticated
  using (es_superadmin()) with check (es_superadmin());

create policy perfiles_ver on perfiles for select to authenticated using (
  id = auth.uid() or admin_id = auth.uid() or es_superadmin());
-- Solo se edita el propio nombre; rol, admin_id y activo se cambian desde el servidor.
create policy perfiles_editar on perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy licencias_ver on licencias for select to authenticated using (
  admin_id = auth.uid() or es_superadmin());
create policy licencias_super on licencias for all to authenticated
  using (es_superadmin()) with check (es_superadmin());

-- empresas: superadmin lee todo; dueño y miembros leen/editan con licencia vigente.
create policy empresas_ver on empresas for select to authenticated using (
  acceso_empresa(id) or es_superadmin());
create policy empresas_editar on empresas for update to authenticated
  using (acceso_empresa(id)) with check (acceso_empresa(id));
create policy empresas_crear on empresas for insert to authenticated with check (
  admin_id = auth.uid() and licencia_vigente(auth.uid())
  and (select count(*) from empresas where admin_id = auth.uid())
      < (select max_empresas from licencias where admin_id = auth.uid()));
create policy empresas_borrar on empresas for delete to authenticated
  using (admin_id = auth.uid() and licencia_vigente(auth.uid()));

create policy miembros_ver on miembros for select to authenticated using (
  user_id = auth.uid() or es_superadmin()
  or exists(select 1 from empresas e where e.id = empresa_id and e.admin_id = auth.uid()));
create policy miembros_gestion on miembros for all to authenticated
  using (exists(select 1 from empresas e where e.id = empresa_id and e.admin_id = auth.uid()))
  with check (exists(select 1 from empresas e where e.id = empresa_id and e.admin_id = auth.uid()));

create policy bitacora_escribir on bitacora for insert to authenticated
  with check (user_id = auth.uid() and (empresa_id is null or acceso_empresa(empresa_id)));
create policy bitacora_ver on bitacora for select to authenticated using (
  user_id = auth.uid() or es_superadmin()
  or exists(select 1 from empresas e where e.id = empresa_id and e.admin_id = auth.uid()));

-- ---------- Permisos (las tablas nuevas no se exponen solas) ----------
grant usage on schema public to authenticated;
grant select on perfiles, licencias, miembros, bitacora, tarifas to authenticated;
grant update (nombre) on perfiles to authenticated;
grant insert, update, delete on licencias, tarifas to authenticated;  -- RLS: solo superadmin
grant select, insert, update, delete on empresas to authenticated;
grant insert, update, delete on miembros to authenticated;
grant insert on bitacora to authenticated;

create function toca_actualizado() returns trigger language plpgsql as $$
begin new.actualizado = now(); return new; end $$;
create trigger empresas_actualizado before update on empresas
  for each row execute function toca_actualizado();
