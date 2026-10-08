/* ============ BASE DE PUESTOS DE TRABAJO ============ */
/* Puestos frecuentes en Guatemala, agrupados por área, con sus responsabilidades típicas. Al elegir uno
   (en la ficha del empleado o en "Puestos y funciones") pasa al catálogo de la empresa, donde se puede
   ajustar. Las funciones van separadas por "|". */
const PUESTOS_BASE_AREAS={
  'Dirección y administración':[
    ['Gerente general','Dirigir y supervisar las operaciones de la empresa|Planificar y controlar el presupuesto anual|Coordinar a los jefes de las distintas áreas|Representar a la empresa ante clientes, proveedores e instituciones|Velar por el cumplimiento de las metas y políticas de la empresa'],
    ['Gerente administrativo','Administrar los recursos humanos, materiales y financieros de la empresa|Elaborar y dar seguimiento al presupuesto de gastos|Supervisar compras, servicios generales y mantenimiento|Establecer procedimientos y controles administrativos|Presentar informes periódicos a la gerencia general'],
    ['Asistente de gerencia','Llevar la agenda y la correspondencia de la gerencia|Preparar informes, presentaciones y documentos|Dar seguimiento a los acuerdos y pendientes de la gerencia|Coordinar reuniones y atender a visitantes|Archivar y resguardar documentos confidenciales'],
    ['Secretaria','Atender llamadas, correos y visitas|Redactar cartas, notas y documentos|Llevar la agenda y el archivo de la oficina|Recibir y distribuir la correspondencia|Controlar la papelería y útiles de oficina'],
    ['Recepcionista','Recibir y orientar a clientes y visitantes|Atender la central telefónica y canalizar llamadas|Registrar el ingreso de visitas|Recibir paquetes y correspondencia|Mantener ordenada el área de recepción'],
    ['Auxiliar administrativo','Apoyar en trámites y gestiones administrativas|Elaborar y archivar documentos|Llevar controles y registros en hojas de cálculo|Gestionar pagos de servicios y proveedores autorizados|Atender requerimientos de las distintas áreas'],
    ['Mensajero','Entregar y recoger documentos y paquetes|Realizar gestiones en bancos e instituciones|Llevar el control de las entregas realizadas|Cuidar el vehículo o motocicleta asignada|Cumplir las rutas y horarios asignados']],
  'Contabilidad y finanzas':[
    ['Contador general','Llevar la contabilidad completa de la empresa y sus libros legales|Elaborar los estados financieros mensuales y anuales|Preparar y presentar las declaraciones de impuestos ante la SAT|Supervisar el trabajo del personal contable|Atender auditorías y requerimientos de la Administración Tributaria'],
    ['Auxiliar contable','Registrar facturas de compras y ventas en el sistema contable|Elaborar partidas contables y conciliaciones bancarias|Archivar y resguardar la documentación contable|Apoyar en la preparación de declaraciones de impuestos|Llevar el control de cuentas por cobrar y por pagar'],
    ['Tesorero','Administrar el flujo de efectivo de la empresa|Programar y realizar los pagos autorizados|Controlar las cuentas bancarias y sus saldos|Custodiar cheques, efectivo y documentos de valor|Elaborar reportes de tesorería'],
    ['Cajero','Recibir cobros en efectivo, tarjeta y cheque|Emitir facturas y comprobantes de pago|Realizar el cuadre y corte de caja diario|Depositar los valores recibidos|Custodiar el fondo de caja asignado'],
    ['Encargado de cobros','Dar seguimiento a la cartera de clientes|Gestionar el cobro de facturas vencidas|Elaborar estados de cuenta y avisos de cobro|Registrar los pagos recibidos|Reportar la antigüedad de saldos'],
    ['Auditor interno','Evaluar el control interno de la empresa|Revisar la correcta aplicación de políticas y procedimientos|Realizar arqueos e inventarios sorpresivos|Elaborar informes de hallazgos y recomendaciones|Dar seguimiento a las medidas correctivas'],
    ['Analista financiero','Analizar los estados financieros y sus indicadores|Elaborar proyecciones y presupuestos|Evaluar proyectos de inversión y financiamiento|Preparar informes para la toma de decisiones|Controlar la ejecución presupuestaria']],
  'Recursos humanos':[
    ['Jefe de recursos humanos','Dirigir el reclutamiento, selección y contratación de personal|Administrar planillas, prestaciones y expedientes laborales|Velar por el cumplimiento de las leyes laborales|Coordinar capacitaciones y evaluaciones de desempeño|Atender conflictos y relaciones laborales'],
    ['Asistente de recursos humanos','Elaborar planillas y controles de asistencia|Integrar y actualizar expedientes del personal|Realizar trámites ante el IGSS y el Ministerio de Trabajo|Apoyar en el reclutamiento y la inducción de personal|Atender consultas de los trabajadores'],
    ['Encargado de planillas','Calcular salarios, horas extra, descuentos y prestaciones|Elaborar y pagar las planillas en su período|Elaborar las planillas del IGSS|Calcular aguinaldo, bono 14, vacaciones e indemnizaciones|Archivar los comprobantes de pago']],
  'Ventas y atención al cliente':[
    ['Gerente de ventas','Planificar y dirigir la estrategia de ventas|Establecer metas y dar seguimiento al equipo de ventas|Negociar con clientes clave|Analizar el mercado y la competencia|Presentar informes de ventas a la gerencia'],
    ['Vendedor','Atender y asesorar a los clientes|Ofrecer y vender los productos o servicios de la empresa|Elaborar cotizaciones y dar seguimiento a pedidos|Gestionar el cobro de las ventas realizadas|Reportar sus ventas y metas al jefe inmediato'],
    ['Vendedor de ruta','Visitar a los clientes de la ruta asignada|Levantar pedidos y entregar productos|Cobrar las facturas y liquidar el efectivo diario|Exhibir los productos en los puntos de venta|Reportar la competencia y las necesidades del mercado'],
    ['Dependiente de mostrador','Atender a los clientes en el punto de venta|Cobrar y facturar las ventas|Ordenar y exhibir la mercadería|Reportar faltantes de inventario|Mantener limpia el área de ventas'],
    ['Agente de servicio al cliente','Atender consultas y reclamos de clientes por teléfono y en línea|Registrar y dar seguimiento a los casos|Informar sobre productos, servicios y precios|Coordinar soluciones con las áreas involucradas|Medir la satisfacción de los clientes'],
    ['Encargado de mercadeo','Planificar campañas de publicidad y promoción|Administrar las redes sociales y la página web|Elaborar material publicitario|Analizar resultados de las campañas|Organizar eventos y lanzamientos']],
  'Compras, bodega y logística':[
    ['Encargado de compras','Cotizar y comprar los bienes y servicios autorizados|Evaluar y seleccionar proveedores|Elaborar órdenes de compra y dar seguimiento a las entregas|Verificar precios, calidad y condiciones de pago|Llevar el registro de proveedores'],
    ['Jefe de bodega','Dirigir la recepción, almacenaje y despacho de mercadería|Controlar el inventario y sus movimientos|Programar conteos físicos|Supervisar al personal de bodega|Velar por la seguridad y el orden de la bodega'],
    ['Bodeguero','Recibir, revisar y almacenar la mercadería|Despachar los productos según los pedidos autorizados|Llevar el control de entradas y salidas de inventario|Mantener la bodega limpia y ordenada|Participar en los conteos físicos de inventario'],
    ['Auxiliar de bodega','Cargar y descargar mercadería|Ordenar y etiquetar los productos|Preparar los pedidos para despacho|Apoyar en los conteos de inventario|Mantener limpia el área de trabajo'],
    ['Piloto repartidor','Conducir el vehículo asignado para la entrega de productos|Cargar y descargar la mercadería con cuidado|Entregar los pedidos y recabar las firmas de recibido|Velar por el buen estado y mantenimiento del vehículo|Cumplir las leyes de tránsito y las rutas asignadas'],
    ['Ayudante de piloto','Cargar y descargar la mercadería|Apoyar en la entrega de pedidos|Revisar que la carga vaya completa y asegurada|Apoyar en el cuidado del vehículo|Reportar incidentes en la ruta'],
    ['Encargado de despacho','Programar las rutas y entregas del día|Verificar los pedidos antes de su salida|Elaborar envíos y guías de despacho|Dar seguimiento a las entregas pendientes|Atender reclamos por entregas']],
  'Producción y operaciones':[
    ['Jefe de producción','Planificar y dirigir la producción|Controlar el uso de materiales, mano de obra y maquinaria|Velar por la calidad y los costos de producción|Supervisar al personal de planta|Presentar informes de producción'],
    ['Supervisor de producción','Supervisar el trabajo del personal de la línea|Verificar el cumplimiento de recetas y estándares|Controlar los reportes de producción y desperdicio|Coordinar el abastecimiento de materiales|Velar por la seguridad industrial'],
    ['Operario de producción','Operar la maquinaria y herramientas de producción asignadas|Cumplir las recetas, especificaciones y estándares de calidad|Reportar los materiales utilizados y el tiempo trabajado|Usar el equipo de protección personal|Mantener limpia y ordenada su área de trabajo'],
    ['Operador de maquinaria','Operar y ajustar la maquinaria asignada|Realizar el mantenimiento básico y la limpieza del equipo|Controlar la calidad del producto en proceso|Reportar fallas y paros de máquina|Cumplir las normas de seguridad'],
    ['Inspector de calidad','Inspeccionar materiales, productos en proceso y terminados|Registrar los resultados de las pruebas de calidad|Separar y reportar el producto no conforme|Verificar el cumplimiento de normas y especificaciones|Proponer mejoras al proceso'],
    ['Empacador','Empacar y etiquetar el producto terminado|Verificar pesos, cantidades y presentación|Armar cajas y tarimas para despacho|Reportar los materiales de empaque usados|Mantener limpia el área de empaque'],
    ['Costurera / Costurero','Confeccionar las piezas según el patrón y las especificaciones|Operar las máquinas de coser asignadas|Revisar la calidad de las prendas|Reportar la producción diaria|Cuidar el equipo y los materiales']],
  'Mantenimiento y servicios generales':[
    ['Encargado de mantenimiento','Dar mantenimiento preventivo y correctivo a instalaciones y equipo|Realizar reparaciones eléctricas, de plomería y generales|Llevar el control de las herramientas y materiales a su cargo|Reportar las fallas y necesidades de repuestos|Cumplir las normas de seguridad industrial'],
    ['Electricista','Instalar y reparar sistemas eléctricos|Dar mantenimiento a tableros, motores y equipo eléctrico|Diagnosticar fallas eléctricas|Cumplir las normas de seguridad eléctrica|Reportar materiales utilizados'],
    ['Mecánico','Dar mantenimiento preventivo y correctivo a vehículos y maquinaria|Diagnosticar y reparar fallas mecánicas|Llevar el control de los servicios realizados|Solicitar los repuestos necesarios|Mantener ordenado el taller'],
    ['Conserje','Mantener limpias las oficinas, baños y áreas comunes|Recoger y clasificar la basura|Controlar los insumos de limpieza|Apoyar en mandados y traslados internos|Reportar daños en las instalaciones'],
    ['Guardia de seguridad','Vigilar las instalaciones y bienes de la empresa|Controlar el ingreso y egreso de personas y vehículos|Realizar rondas de vigilancia y llevar la bitácora|Reportar de inmediato cualquier incidente|Actuar conforme a los protocolos de seguridad establecidos'],
    ['Jardinero','Dar mantenimiento a jardines y áreas verdes|Podar, regar y abonar las plantas|Mantener limpias las áreas exteriores|Cuidar las herramientas de jardinería|Reportar necesidades de insumos']],
  'Tecnología':[
    ['Encargado de informática','Administrar la red, servidores y equipo de cómputo|Dar soporte técnico a los usuarios|Instalar y actualizar programas y sistemas|Realizar las copias de seguridad de la información|Velar por la seguridad informática'],
    ['Técnico de soporte','Atender las solicitudes de soporte de los usuarios|Instalar y configurar equipo de cómputo e impresoras|Diagnosticar y resolver fallas de hardware y software|Llevar el inventario del equipo de cómputo|Documentar los casos atendidos'],
    ['Programador','Desarrollar y mantener los sistemas de la empresa|Analizar los requerimientos de los usuarios|Probar y documentar los programas|Corregir errores y mejorar el rendimiento|Capacitar a los usuarios en el uso de los sistemas']],
  'Construcción y campo':[
    ['Maestro de obras','Dirigir la ejecución de la obra según planos y especificaciones|Organizar y supervisar a albañiles y ayudantes|Controlar el uso de materiales y herramientas|Reportar el avance de la obra|Velar por la seguridad en la obra'],
    ['Albañil','Ejecutar trabajos de albañilería según las indicaciones|Preparar mezclas y levantar muros|Realizar acabados, repellos y pisos|Cuidar las herramientas y materiales|Usar el equipo de protección'],
    ['Ayudante de albañil','Acarrear materiales en la obra|Preparar mezclas|Apoyar al albañil en sus tareas|Limpiar el área de trabajo|Usar el equipo de protección'],
    ['Caporal','Organizar y supervisar las cuadrillas de campo|Distribuir las tareas diarias|Llevar el control de asistencia y de las labores realizadas|Velar por el buen uso de herramientas e insumos|Reportar el avance de las labores al encargado'],
    ['Trabajador agrícola','Realizar labores de siembra, limpia, fertilización y cosecha|Aplicar los insumos según las indicaciones|Cuidar las herramientas asignadas|Cumplir las tareas diarias asignadas|Usar el equipo de protección']],
  'Restaurantes y hoteles':[
    ['Cocinero','Preparar los alimentos según las recetas del menú|Controlar la calidad y presentación de los platillos|Llevar el control de insumos y mermas|Mantener limpia y ordenada la cocina|Cumplir las normas de higiene y manipulación de alimentos'],
    ['Ayudante de cocina','Lavar, pelar y cortar los ingredientes|Apoyar al cocinero en la preparación de alimentos|Lavar trastos y utensilios|Mantener limpia la cocina|Cumplir las normas de higiene'],
    ['Mesero','Atender a los clientes en las mesas|Tomar las órdenes y servir los alimentos y bebidas|Presentar la cuenta y cobrar|Montar y limpiar las mesas|Mantener una actitud de servicio'],
    ['Bartender','Preparar y servir bebidas|Llevar el control del inventario del bar|Atender a los clientes en la barra|Mantener limpia el área del bar|Cumplir las normas de venta responsable de bebidas'],
    ['Camarista','Limpiar y ordenar las habitaciones|Cambiar ropa de cama y reponer amenidades|Reportar daños y objetos olvidados|Cuidar los insumos de limpieza|Cumplir los estándares de limpieza del hotel']],
  'Salud y educación':[
    ['Enfermera / Enfermero','Brindar atención y cuidados de enfermería a los pacientes|Administrar los medicamentos indicados por el médico|Registrar signos vitales y la evolución de los pacientes|Mantener el control del material y equipo médico|Cumplir las normas de bioseguridad'],
    ['Médico','Atender consultas y emitir diagnósticos|Prescribir tratamientos y medicamentos|Llevar el expediente clínico de los pacientes|Referir a especialistas cuando corresponda|Cumplir las normas éticas y de bioseguridad'],
    ['Docente','Planificar e impartir las clases asignadas|Evaluar el aprendizaje de los estudiantes|Llevar los registros de notas y asistencia|Atender a padres de familia|Participar en las actividades de la institución']],
};
const PUESTOS_BASE=Object.entries(PUESTOS_BASE_AREAS).flatMap(([area,lista])=>lista.map(([nombre,f])=>({area,nombre,funciones:f.split('|')})));
