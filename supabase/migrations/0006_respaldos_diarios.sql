-- Respaldos diarios automáticos de cada empresa.
-- Ejecutar completo en Supabase > SQL Editor (una sola vez).
--
-- Cada vez que una empresa se modifica, la base guarda cómo estaba al EMPEZAR ese día (antes del primer
-- cambio del día), y también cómo estaba si se elimina. Se conservan 30 días por empresa. Corre dentro de
-- la base, así que no depende de ninguna computadora ni de que alguien se acuerde de descargar el respaldo.
-- Desde la app (Configuración → Respaldos diarios) se ven y se restauran.

create table if not exists empresas_respaldos (
  empresa_id uuid not null,
  dia date not null,                         -- día (hora de Guatemala) al que corresponde la copia
  admin_id uuid not null,
  nombre text not null default '',
  datos jsonb not null,
  version int,
  eliminada boolean not null default false,  -- copia tomada al eliminar la empresa
  creado timestamptz not null default now(),
  primary key (empresa_id, dia, eliminada)
);
create index if not exists empresas_respaldos_admin on empresas_respaldos(admin_id);

create or replace function respaldar_empresa() returns trigger
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Guatemala')::date;
begin
  if tg_op = 'UPDATE' then
    -- Solo la primera modificación del día guarda el estado anterior: así la copia es "cómo estaba al empezar el día".
    if old.datos is distinct from new.datos or old.nombre is distinct from new.nombre then
      insert into empresas_respaldos(empresa_id, dia, admin_id, nombre, datos, version)
      values (old.id, d, old.admin_id, old.nombre, old.datos, old.version)
      on conflict (empresa_id, dia, eliminada) do nothing;
    end if;
    delete from empresas_respaldos where empresa_id = old.id and dia < d - 30;
    return new;
  else
    insert into empresas_respaldos(empresa_id, dia, admin_id, nombre, datos, version, eliminada)
    values (old.id, d, old.admin_id, old.nombre, old.datos, old.version, true)
    on conflict (empresa_id, dia, eliminada) do update set datos = excluded.datos, nombre = excluded.nombre, version = excluded.version, creado = now();
    return old;
  end if;
end $$;

drop trigger if exists empresas_respaldo on empresas;
create trigger empresas_respaldo before update or delete on empresas
  for each row execute function respaldar_empresa();

alter table empresas_respaldos enable row level security;
drop policy if exists respaldos_ver on empresas_respaldos;
create policy respaldos_ver on empresas_respaldos for select to authenticated using (
  es_superadmin()
  or (admin_id = auth.uid() and licencia_vigente(admin_id))
  or acceso_empresa(empresa_id));
-- Nadie escribe directo: solo el disparador.
revoke insert, update, delete on empresas_respaldos from authenticated, anon;
grant select on empresas_respaldos to authenticated;
