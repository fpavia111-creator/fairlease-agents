# Agentes de flete Keystone

*Traducido por Claude; revisión por hablante nativo pendiente. El [README](README.md) en inglés es la referencia.*

Treinta pequeños agentes MCP para costes de flete y envío. Cada uno se encarga de **una sola tarea**, como auditar una factura de transporte, preparar la provisión de fletes del cierre de mes, liquidar pagos a transportistas o revisar una declaración aduanera, y no puede actuar fuera de ella. Leen los archivos que ya exporta de su TMS, ERP, WMS, portales de transportistas y proveedor EDI, escriben informes en su equipo y esperan a una persona con nombre antes de cualquier cosa que mueva dinero, envíe un mensaje o cambie un sistema en producción.

Licencia MIT · Node 20 o posterior · solo archivos locales · sin credenciales · sin dependencias

## Probar

```bash
npx -y polaris-of-bills demo        # auditoría de facturas de flete con datos ficticios
npx -y procyon-of-accruals demo     # provisión de fletes con datos ficticios
```

Cada agente tiene una `demo` con archivos ficticios, un `eval` con sus propios casos de prueba y un servidor MCP (`npx -y <agent> mcp --root <carpeta>`) para Claude Desktop, Claude Code, Cursor y otros hosts MCP. Por ahora, los nombres de columna y los informes están en inglés.

## Los agentes

**Lo que facturan los transportistas:** `polaris-of-bills` (carga completa y consolidada contra contratos), `sirius-of-parcels` (paquetería), `vega-of-detention` (estadías y esperas), `spica-of-fuel` (recargos por combustible), `betelgeuse-of-accessorials` (origen de los servicios adicionales), `bellatrix-of-reweighs` (repesajes y cambios de clase), `algol-of-duplicates` (pagos dobles), `adhara-of-ocean` (marítimo), `canopus-of-air` (aéreo), `alcor-of-pods` (comprobantes de entrega), `fomalhaut-of-demurrage` (días libres de contenedores y demoras), `antares-of-entries` (declaraciones aduaneras contra facturas comerciales, sin asesoría de clasificación).

**Planificar, comprar y operar el flete:** `altair-of-bids` (licitaciones), `regulus-of-tariffs` (historial revalorizado con cada contrato), `nunki-of-quotes` (cotizaciones spot), `mizar-of-lanes` (gasto por ruta y consolidación), `rigel-of-scorecards` (cuadros de mando de transportistas), `aldebaran-of-carriers` (señales de fraude), `mira-of-tracking` (envíos retrasados), `hadar-of-docks` (citas en andén), `deneb-of-cartons` (tamaños de caja), `arcturus-of-edi` (lectura y conciliación de archivos X12).

**Cierre y costes:** `procyon-of-accruals` (provisión de fletes), `castor-of-allocations` (flete repartido por pedido y centro de costes), `pollux-of-costing` (estándares de flete en el coste de artículos), `elnath-of-margins` (flete cobrado contra flete real por cliente), `alnilam-of-settlements` (pagos a transportistas para brókeres), `capella-of-claims` (reclamaciones por daños), `achernar-of-returns` (devoluciones hasta la nota de crédito), `shaula-of-emissions` (estimaciones de emisiones con los factores que usted elija).

## Cómo se mantienen seguros

- **Lista permitida por agente.** Cada agente solo puede llamar a sus propias herramientas.
- **Herramientas rechazadas.** Pagar, enviar correos, cambiar el TMS, contabilizar en el libro mayor o presentar ante aduanas están nombradas y bloqueadas.
- **Un clic con nombre.** Pagos, envíos, cambios en producción y aprobaciones de asientos esperan a una persona con nombre, incluso en modo Auto, vinculados al sha256 del borrador revisado.
- **Registro de auditoría** en `.keystone/`, encadenado por hash, firmado si configura una clave Ed25519.
- **Parada de emergencia:** `<agent> kill` detiene todas las herramientas hasta `<agent> unkill`.

## Límites

- Cada agente trabaja solo con los archivos que usted le da y no inicia sesión en ningún sistema de transportista, TMS, ERP, banco u organismo público.
- No es asesoría legal, fiscal, aduanera ni contable. Las personas deciden y actúan.
