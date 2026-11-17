# Agentes Keystone para administración de inmuebles

Treinta pequeños agentes MCP para la administración de inmuebles, pensados para administradores comerciales y residenciales de tamaño medio. Cada uno tiene **una sola tarea**, por ejemplo cotejar el rent roll con los contratos, conciliar una cuenta fiduciaria, recalcular los gastos comunes (CAM) o pedir los certificados de seguro de los inquilinos, y no puede actuar fuera de ella. Leen los archivos que ya exporta de AppFolio, Yardi, Buildium, Rent Manager y otros sistemas, escriben informes en su equipo, nunca mueven dinero ni cambian un sistema en producción, y esperan a una persona con nombre antes de que salga cualquier carta o aviso.

Licencia MIT · Node 20 o posterior · solo archivos locales · sin credenciales · sin dependencias

Otros idiomas: [English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md) (traducido por Claude; revisión nativa pendiente)

## Probar uno

Desde una copia de este repositorio:

```bash
npm ci
node packages/granite-of-rentrolls/bin/granite-of-rentrolls.js demo     # rent roll contra fichas de contrato, datos ficticios
node packages/obsidian-of-trust/bin/obsidian-of-trust.js demo           # conciliación a tres bandas de una cuenta fiduciaria, datos ficticios
```

Cuando los paquetes estén en npm, lo mismo funciona con `npx -y granite-of-rentrolls demo`. Cada agente tiene un `demo` con archivos ficticios, un `eval` que lo comprueba contra sus propios casos de prueba, un `inspect <archivo>` que muestra cómo se leyeron las columnas y un servidor MCP (`<agente> mcp --root <carpeta>`) para Claude Desktop, Claude Code, Cursor y otros hosts MCP. Con `--lang es` los títulos, encabezados y nombres de columna de los informes y la página de aprobaciones salen en español (nueve idiomas disponibles); las frases de los hallazgos y los resultados de las herramientas siguen en inglés. El README de cada agente lista sus herramientas.

## Los agentes

**Rent roll, contratos e ingresos**

| Agente | Qué hace | Nunca hace (bloqueado) |
|---|---|---|
| [`granite-of-rentrolls`](packages/granite-of-rentrolls) | Rent roll contra sus fichas de contrato, unidad por unidad: rentas, escalonados, fechas, depósitos, superficies, inquilinos, vacantes, prórrogas tácitas | Cambiar el sistema de administración o cargar importes |
| [`slate-of-leases`](packages/slate-of-leases) | Contratos comerciales resumidos cláusula por cláusula con la cita de cada término; fichas existentes cotejadas con el texto | Cambiar el sistema o enviar a firma |
| [`jade-of-escalations`](packages/jade-of-escalations) | Renta facturada contra el calendario de actualización de cada contrato (escalones, porcentajes, IPC con suelo y techo); subidas próximas | Cargar importes |
| [`garnet-of-renewals`](packages/garnet-of-renewals) | Contratos por renovar, plazos de oferta, rentas propuestas dentro de su propio tope, cartas de oferta en borrador | Enviar a firma o por correo |
| [`shale-of-vacancy`](packages/shale-of-vacancy) | Ocupación, porcentaje alquilado, exposición, pérdida por vacancia y pérdida frente a mercado a partir de un rent roll | Cambiar el sistema o publicar anuncios |
| [`talc-of-overage`](packages/talc-of-overage) | Renta variable sobre ventas a partir de los informes de los inquilinos, informes tardíos o ausentes, liquidación en borrador | Cargar importes o iniciar una auditoría de ventas |
| [`feldspar-of-estoppels`](packages/feldspar-of-estoppels) | Certificados de inquilino (estoppels) devueltos, contra sus fichas de contrato antes de una venta o refinanciación | Enviar a firma o subir a un data room |
| [`zircon-of-diligence`](packages/zircon-of-diligence) | Rent roll de un vendedor contra los ingresos de los últimos doce meses antes de comprar o prestar | Presentar una oferta o subir a un data room |
| [`tourmaline-of-migration`](packages/tourmaline-of-migration) | Rent roll del sistema antiguo contra el del nuevo en la migración: unidades, inquilinos, rentas, depósitos, saldos, fechas, totales que no cuadran | Aprobar la puesta en marcha o borrar datos antiguos |

**Inquilinos, comercialización y cobros**

| Agente | Qué hace | Nunca hace (bloqueado) |
|---|---|---|
| [`quartz-of-delinquency`](packages/quartz-of-delinquency) | Antigüedad de saldos o cuenta del inquilino convertida en lista de trabajo con las etapas de su propia política, revisión de recargos, recordatorios en borrador | Notificar requerimientos, presentar desahucios o informar a burós de crédito |
| [`jasper-of-deposits`](packages/jasper-of-deposits) | Fianzas a la salida contra sus propias reglas (plazo, detalle, desgaste normal, vida útil); liquidación en borrador | Devolver dinero o enviar a cobranza |
| [`amber-of-insurance`](packages/amber-of-insurance) | Certificados de seguro de los inquilinos contra los límites, asegurados adicionales y fechas que exige el contrato | Contratar un seguro por cuenta del inquilino o notificar incumplimientos |
| [`topaz-of-utilities`](packages/topaz-of-utilities) | Reparto de suministros (RUBS) recalculado con su propio método; sobrerrecuperación, unidades vacías facturadas, picos | Cargar importes o cambiar portales de suministros |
| [`cobalt-of-listings`](packages/cobalt-of-listings) | Anuncios en todos los portales contra el rent roll; redacción señalada para que la revise una persona | Publicar anuncios, cambiar la renta pedida o responder a interesados |
| [`mica-of-leads`](packages/mica-of-leads) | Embudo de alquiler a partir de fichas de interesados: respuestas lentas o ausentes, seguimientos pendientes, conversión y coste por contrato según la fuente | Decidir solicitudes, hacer verificaciones o escribir a interesados |
| [`malachite-of-recerts`](packages/malachite-of-recerts) | Fechas y avisos de recertificación en vivienda asequible según el calendario de su archivo de política. Solo fechas | Certificar hogares, enviar a un organismo o cambiar rentas |
| [`lapis-of-payouts`](packages/lapis-of-payouts) | Liquidaciones de alquiler vacacional de Airbnb, Vrbo y otros contra reservas e ingresos bancarios | Reembolsar a huéspedes, pagar a propietarios o cambiar anuncios del canal |

**Propietarios, cuentas fiduciarias y contabilidad**

| Agente | Qué hace | Nunca hace (bloqueado) |
|---|---|---|
| [`obsidian-of-trust`](packages/obsidian-of-trust) | Conciliación a tres bandas: extracto bancario, registro de libros, cuentas de propietarios e inquilinos | Mover fondos, anular cheques o asentar en el mayor |
| [`onyx-of-statements`](packages/onyx-of-statements) | Liquidaciones a propietarios revisadas antes de enviarse: cálculos, saldo arrastrado, reservas, distribuciones | Pagar a propietarios o publicar liquidaciones |
| [`pyrite-of-fees`](packages/pyrite-of-fees) | Honorarios de administración, alquiler y recargos recalculados con cada contrato de gestión | Asentar abonos o cambiar la configuración de honorarios |
| [`marble-of-cam`](packages/marble-of-cam) | Conciliación de gastos comunes (CAM): bolsas de gasto, cuotas, ajuste por ocupación, topes, años base, honorarios de gestión | Cargar importes o cambiar el sistema |
| [`beryl-of-budgets`](packages/beryl-of-budgets) | Presupuesto contra real, desviaciones que el contrato obliga a explicar, previsión de cierre, nota al propietario en borrador | Cambiar el presupuesto o asentar en el mayor |
| [`pearl-of-filings`](packages/pearl-of-filings) | Preparación de los formularios 1099 de EE. UU.: totales por beneficiario contra el umbral que usted da, NIF y direcciones faltantes; NIF siempre enmascarados | Presentar 1099, cotejar NIF o iniciar retenciones |
| [`coral-of-associations`](packages/coral-of-associations) | Cuentas de propietarios de comunidades (HOA, propiedad horizontal) contra su política de cuotas y cobro; infracciones contra sus pasos de aviso | Inscribir embargos o cargar multas |
| [`chert-of-taxes`](packages/chert-of-taxes) | Valoraciones del impuesto sobre bienes inmuebles, plazos de pago y las fechas de recurso que usted registra; calendario de vencimientos | Presentar recursos o pagar impuestos |

**Operaciones y proveedores**

| Agente | Qué hace | Nunca hace (bloqueado) |
|---|---|---|
| [`agate-of-workorders`](packages/agate-of-workorders) | Órdenes de trabajo abiertas envejecidas contra sus plazos objetivo, problemas repetidos, urgencias registradas como rutina, proveedores lentos | Asignar proveedores, aprobar facturas o cerrar órdenes |
| [`basalt-of-turns`](packages/basalt-of-turns) | Rotación de unidades de la salida a la entrada: días, coste por gremio, partidas repercutibles, renta perdida | Asignar proveedores o cargar importes |
| [`flint-of-inspections`](packages/flint-of-inspections) | Inspección de salida contra la de entrada, punto por punto, inspecciones vencidas, puntos en mal estado sin orden de trabajo | Cargar importes o asignar proveedores |
| [`gypsum-of-capex`](packages/gypsum-of-capex) | Proyectos de inversión contra presupuesto, compromisos, calendario y reservas | Aprobar órdenes de cambio o facturas |
| [`opal-of-vendors`](packages/opal-of-vendors) | Seguro, licencia y formulario fiscal de los proveedores contra sus requisitos; pagos hechos sin cumplirlos | Aprobar facturas o cambiar el estado del proveedor |

## Cómo se mantienen seguros

- **Lista permitida por agente.** Cada agente solo puede llamar a sus propias herramientas. Todo lo demás se bloquea, incluidas las herramientas que invente un modelo.
- **Herramientas rechazadas.** Cada agente nombra las acciones reales cercanas a su tarea (reembolsos, cargos, desahucios, presentaciones, envío de correos) y las bloquea, de modo que un modelo que las pida recibe un rechazo claro.
- **Un clic con nombre.** Enviar un borrador, aceptar algo que el agente deba recordar o aprobar una puesta en marcha espera a una persona con nombre, incluso en modo Auto. La aprobación queda ligada al sha256 del borrador revisado; si el borrador cambia, la aprobación deja de coincidir.
- **Registro de auditoría.** Cada llamada se escribe en un registro encadenado por hash bajo `.keystone/`, firmado con Ed25519 si configura una clave.
- **Interruptor de parada.** `<agente> kill` detiene todas las herramientas hasta `<agente> unkill`.
- **Probados contra entradas hostiles.** Fórmulas de hoja de cálculo, HTML, trucos de ruta y texto dirigido al modelo se plantan en los datos de cada agente (`npm run hostile`).
- **Pocos datos personales.** Los NIF se enmascaran en cada informe. El registro de auditoría guarda un hash de los argumentos, no los argumentos, y los agentes no guardan copia de sus archivos.

## Con Claude Code

Este repositorio es un marketplace de plugins de Claude Code. Cada agente es un plugin que arranca su servidor MCP con `npx`:

```text
/plugin marketplace add <ruta o URL git de este repositorio>
/plugin install granite-of-rentrolls@keystone-property
```

Los plugins arrancan `npx -y <agente>@<versión>`, así que necesitan esa versión en npm. Mientras tanto, añada un agente desde una copia local:

```bash
claude mcp add granite-of-rentrolls -- node /ruta/a/keystone-agents/packages/granite-of-rentrolls/bin/granite-of-rentrolls.js mcp --root .
```

## Desarrollar

```bash
npm ci
npm test                       # pruebas y evals de cada paquete
npm run hostile                # entradas hostiles plantadas en cada agente
npm run bench                  # tiempos con 1.000 y 10.000 filas
npm run plugin:check           # archivos de plugin acordes con los paquetes
npm run intl                   # cada eval otra vez con archivos de otros ocho mercados
npm run mcp:check              # cliente oficial del SDK de MCP contra cada agente
npm run release:check:offline  # contenido de paquetes, licencias, documentación y versiones
```

El workflow de CI corre en Node 20, 22 y 24, en Linux y Windows.

## Límites

- Cada agente trabaja con los archivos que usted le da. Ninguno inicia sesión en un sistema de administración, banco, portal de anuncios, canal u organismo público.
- Los formatos de exportación con nombre se escribieron a partir del conocimiento de esas exportaciones y no se comprobaron contra cuentas reales. Si un encabezado difiere, `inspect` muestra lo que se asignó y `keystone-sources.json` permite nombrar columnas a mano.
- Los hallazgos valen lo que valen esos archivos. Cada informe dice qué supuso.
- No es asesoramiento legal, fiscal ni contable, ni un juicio sobre si un anuncio es lícito. Umbrales, plazos y reglas de honorarios vienen de sus propios archivos de política. Las personas deciden y actúan.
