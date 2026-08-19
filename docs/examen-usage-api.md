# Examen: API de uso de Amsterdam Console

Material de estudio del API construida en este proyecto: `/api/usage`,
`/api/billing`, `/api/manual-credits`, la capa `usage-sources`, la línea
de tiempo y el export SQLite. Total: **100 puntos**. Aprobado: **70**.

Reglas: puedes usar el código fuente y el daemon en vivo
(`http://localhost:3131`). Las secciones A, B y C son teóricas. La
sección D es práctica: debes ejecutar los comandos.

---

## Sección A — Opción múltiple (10 × 4 = 40 puntos)

**A1.** Los logs de Pi no existen en la máquina. ¿Qué devuelve
`GET /api/usage`?

- a) HTTP 500 con `{ "error": "..." }`
- b) HTTP 200 con la fuente `pi` en `available: false`
- c) HTTP 404
- d) HTTP 200 sin la clave `sources`

**A2.** ¿Cuál es el formato y la zona horaria de `timeline.rows[].bucket`?

- a) ISO 8601 completo en hora local
- b) `'YYYY-MM-DD HH:MM'` en UTC
- c) época Unix en segundos
- d) `'YYYY-MM-DD'` en UTC

**A3.** ¿Por qué Hermes no aparece en el gráfico "Credits used by time"?

- a) Porque sus costos son estimados
- b) Porque su base de datos no tiene marcas de tiempo por llamada
- c) Porque el daemon no puede leer `~/.hermes/state.db`
- d) Porque Hermes no es un orquestador

**A4.** ¿Qué significa `kind: 'actual'` en la fuente `pi`?

- a) El costo viene de una API de facturación remota
- b) El costo es USD real facturado, leído de los logs de sesión
- c) El costo se estimó con precios de lista
- d) El costo se cargó a mano

**A5.** Con el rango "24h" y granularidad en `Auto`, ¿qué tamaño de
bloque usa el gráfico?

- a) 5 minutos
- b) 1 hora
- c) 1 día
- d) 240 bloques fijos

**A6.** ¿Dónde se ocultan (`purge`) las filas de `claude-*` y
`anthropic`?

- a) En `/api/usage`
- b) En el export `data/usage.db`
- c) En el dashboard `index.html`
- d) En todas las salidas

**A7.** ¿Qué hace `POST /api/manual-credits` con
`{ "provider": "pi", "amount": null }`?

- a) Devuelve 400: amount inválido
- b) Pone el crédito de `pi` en 0
- c) Borra la entrada `pi`
- d) No hace nada

**A8.** Quieres añadir un orquestador nuevo al monitor. ¿Qué haces?

- a) Modificar `index.html` y `server.js`
- b) Añadir una entrada al registro `SOURCES` en `usage-sources.js` con
  su `read(env)`
- c) Crear una tabla nueva en `usage.db`
- d) Añadir un provider en `catalog.js`

**A9.** ¿Qué granularidad envía el servidor en `timeline.rows`?

- a) La que pide el cliente por query string
- b) Siempre 5 minutos, historial completo; el cliente agrupa
- c) Siempre por día
- d) Los últimos 240 bloques de 5 minutos

**A10.** Hermes guarda `last_seen` como época Unix en segundos.
¿Dónde se convierte a ISO?

- a) En el navegador, al pintar
- b) En SQLite con `strftime`
- c) En `usage-sources.js`, con `toIso()`
- d) No se convierte

---

## Sección B — Verdadero o falso (5 × 2 = 10 puntos)

**B1.** `/api/billing` guarda caché 60 segundos y `?fresh` la salta.

**B2.** `amster export-usage` inserta filas nuevas en `usage.db` sin
borrar las viejas (append incremental).

**B3.** El servidor recorta `timeline.rows` a los últimos 240 bloques.

**B4.** `usage.html` funciona sin daemon, solo más lenta.

**B5.** Un `POST /api/manual-credits` válido invalida la caché de
billing para que el chip de Pi se actualice de inmediato.

---

## Sección C — Respuesta corta (5 × 4 = 20 puntos)

**C1.** Explica el principio "degradar, nunca desaparecer" con un
ejemplo concreto de este API.

**C2.** ¿Por qué los bloques de tiempo están en UTC y no en hora local?

**C3.** En una fila de Hermes, ¿qué diferencia hay entre
`costUsd: null` y `costUsd: 0`?

**C4.** ¿Por qué la normalización (ISO, forma de las filas) vive en la
capa de fuentes y no en la página?

**C5.** Nombra las dos piezas mínimas de una entrada del registro de
orquestadores y el contrato de su `read(env)`.

---

## Sección D — Práctica (5 × 6 = 30 puntos)

El daemon debe estar corriendo: `./scripts/amster status`.

**D1.** Obtén el gasto total combinado. Ejecuta y anota el resultado:

```bash
curl -s http://localhost:3131/api/usage | node -e "
let d='';process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>console.log(JSON.parse(d).totalUsd));"
```

**D2.** Lista los modelos con su costo en la fuente `pi`, de mayor a
menor:

```bash
curl -s http://localhost:3131/api/usage | node -e "
let d='';process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  const pi=JSON.parse(d).sources.find(s=>s.id==='pi');
  for(const m of pi.models) console.log(m.model, m.costUsd);
});"
```

**D3.** Consulta el gasto por bloque de 5 minutos de las últimas 24
horas en SQLite:

```bash
node --input-type=module -e "
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/usage.db', { readOnly: true });
console.table(db.prepare(\`
  SELECT bucket, model, calls, cost_usd FROM spend_5min
  WHERE bucket >= strftime('%Y-%m-%d %H:%M', 'now', '-1 day')
  ORDER BY cost_usd DESC LIMIT 5\`).all().map(r=>({...r})));
db.close();"
```

**D4.** Añade un crédito manual de prueba y bórralo. Anota los dos
códigos HTTP:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"provider":"pi","amount":1}' \
  http://localhost:3131/api/manual-credits
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"provider":"pi","amount":null}' \
  http://localhost:3131/api/manual-credits
```

**D5.** Demuestra la degradación elegante. Ejecuta y explica la salida:

```bash
node --input-type=module -e "
import { readUsageSources } from './src/usage-sources.js';
const u = readUsageSources({
  PI_SESSIONS_DIR: '/no/existe',
  HERMES_STATE_DB: '/no/existe.db',
  AMSTERDAM_LOCAL_MODELS_DIR: '/no',
});
console.log(u.sources.map(s=>s.id+'='+s.available), 'total', u.totalUsd);"
```

---

## Clave de respuestas

<details>
<summary>Ver soluciones</summary>

**A1.** b — una fuente caída se reporta `available: false`; el endpoint
sigue vivo.
**A2.** b — `'YYYY-MM-DD HH:MM'` en UTC (`bucket5min`).
**A3.** b — Hermes solo agrega por sesión; no hay timestamp por llamada.
**A4.** b — USD real parseado de `~/.pi/agent/sessions`.
**A5.** b — `autoGrain(24 h)` → `hour` (más de 6 h y hasta 48 h).
**A6.** c — solo el dashboard; el monitor y el export muestran los logs
como son.
**A7.** c — `amount: null` borra la entrada (upsert con delete).
**A8.** b — una entrada en `SOURCES` con `read(env)`; API y página la
recogen solas.
**A9.** b — siempre 5 minutos, historial completo; el cliente filtra por
rango y agrupa con `rollupTimeline`.
**A10.** c — `toIso()` en la capa de fuentes.

**B1.** V (`CACHE_TTL_MS = 60_000`, `?fresh`).
**B2.** F — es un full-refresh: `DELETE` + insert en una transacción.
**B3.** F — desde el selector de rangos se envía el historial completo;
el tope es solo un parámetro opcional de `buildTimeline`.
**B4.** F — sin daemon no hay `/api/usage`; la página muestra el estado
offline.
**B5.** V — el POST resetea `cache` para refrescar el chip de Pi.

**C1.** Ejemplo: si falta `~/.pi/agent/sessions`, `/api/usage` responde
200 con `pi.available: false`, `models: []`, y el resto de fuentes
siguen llegando. La página enseña la tarjeta "unavailable" en vez de un
error total.
**C2.** Los timestamps de los logs son UTC. Mezclar zonas rompe la
comparación de cadenas (`bucket >= from`) y los cruces de día.
**C3.** `null` = snapshot no confiable (estado `unknown` con costo
registrado): se oculta para no contar un fantasma. `0` = costo cero
registrado: es un dato real.
**C4.** Porque hay varios consumidores (API, página, export) y cada
orquestador conoce su formato. Normalizar una vez en el borde evita
lógica duplicada en cada consumidor.
**C5.** `id/label/kind` y `read(env)` que devuelve
`{ models, totalUsd, sessionCount }` o `null` si no está disponible.

**D1.** Un número, p. ej. `43.4993`.
**D2.** Lista ordenada por costo (la API ya la ordena desc).
**D3.** Hasta 5 filas de `spend_5min`.
**D4.** `200` y `200`; un body inválido daría `400`.
**D5.** `pi=false hermes=false total 0` — sin datos, el agregador no
lanza excepciones: reporta fuentes no disponibles.

</details>

## Rúbrica

| Sección | Puntos | Qué evalúa |
|---------|--------|------------|
| A | 40 | Forma de la API y decisiones de diseño |
| B | 10 | Detalles de comportamiento |
| C | 20 | Razonamiento de arquitectura |
| D | 30 | Manejo real con curl, node y SQLite |
