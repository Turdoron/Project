-- Convierte en superadmin al usuario admin@tinbrew.com.
-- Antes: crear ese usuario en Supabase > Authentication > Users > Add user
-- (con "Auto Confirm User" marcado). La contraseña se escribe allí, nunca en este archivo.
insert into perfiles (id, nombre, rol)
select id, 'Superadministrador', 'superadmin'
from auth.users
where email = 'admin@tinbrew.com'
on conflict (id) do update set rol = 'superadmin', activo = true;
