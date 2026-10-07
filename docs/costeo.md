# Contabilidad de costos — ADCONTIS Módulo Contable

El módulo de Producción costea lo fabricado y lo registra en la contabilidad. La ley (Art. 41 del Dto. 10-2012) y la NIC 2 piden valuar el inventario fabricado a su **costo de producción**: materiales directos, mano de obra directa y costos indirectos de fabricación (CIF). También piden mantener el método elegido.

## 1. Los tres métodos

| Método | Cuándo conviene | Cómo se calcula el costo |
|---|---|---|
| **Por órdenes** | Pedidos o lotes distintos entre sí (calzado por pedido, muebles, imprenta). | Cada orden tiene su hoja de costos, con **fecha de inicio y de fin**. Costo unitario = costo de la orden ÷ unidades terminadas. |
| **Proceso continuo** | Producción en serie que pasa por procesos en orden (corte → aparado → montaje; ribera → curtido → acabado). | **Informe de costo de producción** por proceso y por período: unidades equivalentes con promedio ponderado. Lo que termina un proceso pasa al siguiente con su costo. |
| **Costo estándar** | Productos repetitivos en los que interesa medir la eficiencia. | **Hoja de costo estándar** (receta con precios estándar, horas estándar y tasa de CIF). Lo terminado entra al estándar y las diferencias se separan en variaciones. |

## 2. Cómo se registra cada elemento

El inventario se lleva con el sistema periódico, igual que el resto del sistema.

| Hecho | Debe | Haber |
|---|---|---|
| Requisición de materiales (al costo promedio o PEPS) | 1.1.18 Productos en proceso | 1.1.08 Inventarios |
| Boleta de tiempo: horas × tarifa | 1.1.18 Productos en proceso | Cuenta de sueldos donde la planilla registró el gasto (se **traslada**, no se duplica) |
| CIF aplicado con la tasa predeterminada | 1.1.18 Productos en proceso | 5.1.10 CIF aplicados |
| CIF reales del mes (energía, depreciación, mantenimiento…) | Sus cuentas de gasto, como siempre | Caja o bancos, proveedores, depreciación acumulada |
| Orden o corrida terminada | 1.1.08 Inventarios (y kardex) | 1.1.18 Productos en proceso |
| Pérdida anormal en proceso continuo | 5.1.09 Pérdidas anormales | 1.1.18 Productos en proceso |
| Cierre de CIF del período | 5.1.10 CIF aplicados | Cuentas de CIF reales; la diferencia va a 5.1.08 (subaplicados al debe, sobreaplicados al haber) |
| Variaciones del costo estándar | 5.1.05, 5.1.11, 5.1.06, 5.1.12, 5.1.07 (desfavorables al debe, favorables al haber) | |

La mano de obra que no se aplica a órdenes queda como gasto: es mano de obra indirecta o tiempo ocioso.

## 3. Costos indirectos: tasa predeterminada (costeo normal)

- **Tasa** = CIF fijos presupuestados del año ÷ capacidad normal + CIF variable por unidad de base.
- **Base de aplicación** (la elige cada empresa): horas de MOD, costo de MOD, horas máquina o unidades.
- Los CIF se aplican **con cada boleta**. Si la base es por unidades, se aplican al cerrar la orden.
- **Cierre de CIF del período**: se comparan los reales con los aplicados.
  - Cuando lo aplicado es menor que lo real, hay **subaplicación**: un gasto mayor que lo absorbido.
  - Cuando lo aplicado es mayor, hay **sobreaplicación**.
  - El sistema separa la diferencia en dos:
    - **Variación de presupuesto** = real − presupuesto flexible.
    - **Variación de volumen o capacidad** = presupuesto flexible − aplicado.
- **NIC 2**:
  - El CIF fijo se reparte según la **capacidad normal**.
  - Un período de baja producción no encarece cada unidad: el CIF no absorbido (capacidad ociosa) es gasto del período.
  - Por eso la variación va a resultados y no al inventario.

**Empresa nueva, sin historia:** el estimador arma la tasa con lo que se espera:
- capacidad normal = trabajadores (o máquinas) × horas al mes × 12 × % de aprovechamiento;
- CIF del año = gastos indirectos esperados por mes × 12.

Con unos meses de operación, «Calcular con lo registrado» la ajusta con el promedio real de CIF y de horas.

**Alternativa, costeo real:** los CIF reales del período se reparten al final entre las órdenes con «Repartir costo común». La base de reparto puede ser unidades, horas, costo de materiales, porcentajes o partes iguales.

## 4. Recetas: control de lo que se usó

La receta (lista de materiales o fórmula) dice qué **debía** usarse. Las cantidades se expresan de una de dos formas:
- **Por unidad producida**. Ejemplo, calzado: pies² de cuero, suela, pegamento e hilo **por par**.
- **Por la materia prima base**, como cantidad o como **% de su peso o volumen**. Ejemplo, tenería: sal 8 % y cromo 6 % **del peso del cuero**; en el acabado, litros de pintura **por hoja**.

«Consumir según receta» calcula lo que corresponde, deja corregir lo realmente usado y lo descarga del inventario. Cada orden o corrida muestra el **control de consumo**: lo que debía usarse frente a lo que se usó, con el resultado («según receta», «usó 4.8 % más», «usó 5 % menos»). También compara las horas estándar con las reales. Una orden puede usar varias recetas, una por proceso.

Las cantidades de la receta tienen que estar en la misma unidad en que se lleva el material en el inventario (kg, lb, litros o unidades).

## 5. Proceso continuo: informe de costo de producción

Para cada proceso, en orden:
1. **Cantidades**: en proceso al inicio + iniciadas o recibidas = terminadas y transferidas + en proceso al final + pérdida normal + pérdida anormal.
2. **Unidades equivalentes** (promedio ponderado):
   - costo recibido = T + W + A
   - materiales = T + W × % de avance de materiales + A
   - conversión = T + W × % de avance de conversión + A

   (T = terminadas y transferidas, W = en proceso al final, A = pérdida anormal.)
3. **Costo unitario** = (en proceso al inicio + costos del período) ÷ unidades equivalentes, para cada elemento.
4. **Asignación**:
   - lo transferido pasa al siguiente proceso (el último lo pasa al inventario);
   - la pérdida anormal va a resultados;
   - lo que queda en proceso inicia la corrida del período siguiente.

La **pérdida normal** no entra en las unidades equivalentes: su costo lo absorben las unidades buenas. La **anormal** sí entra (se detecta al final del proceso) y va a resultados (NIC 2: el desperdicio anormal no es costo del inventario).

## 6. Costo estándar: variaciones

| Variación | Fórmula |
|---|---|
| Precio de materiales | (precio real − precio estándar) × cantidad real |
| Cantidad de materiales | (cantidad real − cantidad estándar permitida) × precio estándar |
| Tarifa de mano de obra | (tarifa real − tarifa estándar) × horas reales |
| Eficiencia de mano de obra | (horas reales − horas estándar permitidas) × tarifa estándar |
| Eficiencia de CIF | CIF aplicado a la base real − CIF estándar permitido |

Las variaciones de presupuesto y de volumen del CIF salen en el cierre de CIF del período. La suma de todas las variaciones explica exactamente la diferencia entre el costo real y el estándar.

## 7. Cómo configurarlo según la empresa

1. **Configuración de costos**:
   - procesos, en orden;
   - tarifa por hora (el sistema la puede calcular desde la última planilla: costo laboral total ÷ horas ordinarias de 44 h semanales);
   - cuenta de sueldos de la que se traslada la MOD;
   - forma de cargar los CIF y su base;
   - presupuesto y capacidad normal;
   - cuentas de CIF reales.
2. **Recetas** de cada producto. Con costo estándar, la receta lleva precios estándar.
3. Cada **orden o corrida**: requisiciones o consumo según receta, boletas de mano de obra con fecha dentro de su período, y al final «Cerrar y pasar a inventario».
4. Cada mes: **Cierre de CIF del período**.

**Ejemplo, fábrica de zapatos por órdenes:**
- Procesos: Corte, Aparado y Montaje.
- Receta por par.
- CIF por horas de MOD.
- La hoja de costos de cada pedido muestra el costo por par y si se usó más cuero o más horas de lo debido.

**Ejemplo, tenería en proceso continuo:**
- Procesos: Ribera, Curtido y Acabado.
- Fórmula de curtido en % del peso del cuero (kg) y fórmula de acabado en litros por hoja.
- El informe de costo por proceso incluye las pérdidas normal y anormal; lo que queda en proceso pasa al mes siguiente.
