-- Corrige: no se podía crear empresas. Al insertar, la base devuelve la fila creada y la regla de
-- lectura usaba una función que consulta la misma tabla, sin ver la fila nueva. Ahora el dueño se
-- reconoce directamente por la columna admin_id.
drop policy if exists empresas_ver on empresas;
create policy empresas_ver on empresas for select to authenticated using (
  es_superadmin()
  or (admin_id = auth.uid() and licencia_vigente(admin_id))
  or acceso_empresa(id));

drop policy if exists empresas_editar on empresas;
create policy empresas_editar on empresas for update to authenticated
  using ((admin_id = auth.uid() and licencia_vigente(admin_id)) or acceso_empresa(id))
  with check ((admin_id = auth.uid() and licencia_vigente(admin_id)) or acceso_empresa(id));

-- Solo se editan el nombre y los datos: nadie puede cambiar el dueño de una empresa.
revoke update on empresas from authenticated;
grant update (nombre, datos) on empresas to authenticated;
