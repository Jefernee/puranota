# PuraNota — Documento maestro

> **Este archivo es la fuente de verdad del proyecto.** Si vas a trabajar en
> PuraNota (seas persona o agente), leé esto completo antes de tocar código.
> Está escrito para poder pegarse tal cual en un chat nuevo y que quien lo lea
> entienda todo el sistema sin abrir otra cosa.
>
> - `CLAUDE.md` (este archivo) → **qué es, cómo funciona, cómo se calcula todo.**
> - `README.md` → presentación del proyecto y cómo correrlo.
> - `docs/PLAN.md` → decisiones cerradas y orden de trabajo (a dónde va).
> - `docs/ADR.md` → historial de decisiones (ADR-001 … ADR-006). Contexto de *por
>   qué* se llegó acá. Si hay contradicción, **manda este archivo**.
> - `backend/aula_cr_fase1_schema.sql` → el SQL original de Fase 1. **Está
>   desactualizado**: faltan las columnas agregadas después (ver §6).
>
> Última revisión: 2026-07-25.

---

## 1. Qué es PuraNota

Plataforma web para docentes del **MEP (Costa Rica)**. Un grupo = una materia con
un docente y sus estudiantes, durante **todo el año lectivo**.

El docente:
- crea grupos y comparte un **código de 6 caracteres** para que entren,
- define **rubros de evaluación por periodo** (Trabajo cotidiano, Tareas, Pruebas…),
- crea **asignaciones** (cotidianos, tareas, pruebas) con fecha límite y rúbrica,
- **revisa y califica** las entregas (fotos/PDF),
- pasa **asistencia**,
- publica **clases** con contenido, video de YouTube o video propio y adjuntos,
- ve el **cuadro de notas** del grupo por periodo.

El estudiante (casi siempre desde el **celular**):
- se une con el código, ve sus asignaciones y fechas,
- sube su entrega (fotos o PDF), la puede reemplazar antes de la fecha límite,
- ve su **nota por rubro y del periodo**, sus observaciones, las clases y su asistencia.

**El norte del producto: simplicidad.** Tan fácil que "hasta un chiquito" lo use.
Ante la duda entre *simple* y *configurable*, gana simple. Todo el texto de la
interfaz va en **español de Costa Rica**, tono cercano, nada robótico.

### Estado actual

- **Fase 1: completa y probada de punta a punta.** Auth, grupos, matrícula,
  asignaciones, entregas, revisión, asistencia, clases y notas funcionan.
- Extras que se hicieron además del alcance original: sistema de contraseñas con
  3 vías de recuperación, subida a Cloudflare R2, video propio en clases,
  asistencia que cuenta para la nota, **Modo MEP** (presets del reglamento 2026),
  tema oscuro, módulo de avisos, rediseño responsive.
- **Fase 2 (NO construida):** pre-revisión con IA (Gemini) vía Edge Function.
- **Fase 3 (NO construida):** export a Excel, notificaciones, bitácora.

---

## 2. Reglas para quien trabaje en esto

1. **No cambiar el stack** sin consultar (§3).
2. **Ninguna llamada a Supabase fuera de `frontend/src/services/`.** Los
   componentes nunca importan el cliente de Supabase. Es lo que permite migrar de
   backend tocando una sola carpeta.
3. **La base es de producción.** No hay migraciones automáticas: los cambios de
   esquema se corren **a mano** en el SQL Editor de Supabase y se anotan en §6.
   Todo cambio debe ser **aditivo** (agregar columna con default, agregar política).
4. **Nunca exponer la `service_role` key en el frontend.** Todo lo que la necesite
   va en una Edge Function.
5. **Errores siempre con mensaje en español** útil para el usuario final.
6. **Al dar opciones al usuario, marcar explícitamente cuál se recomienda.**
7. Commits pequeños y descriptivos en español.
8. No instalar librerías pesadas. Permitidas: `@supabase/supabase-js`,
   `react-router-dom`, `browser-image-compression`. Para todo lo demás, nativo.
9. Al terminar algo, decir **cómo probarlo a mano**.

---

## 3. Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + **JavaScript (no TypeScript)** + Tailwind CSS + react-router-dom 6 |
| Backend | Supabase (Auth + Postgres con RLS + Edge Functions en Deno) |
| Archivos | **Cloudflare R2** (no Cloudinary) vía URL pre-firmada |
| Video | YouTube embebido **o** video propio en R2 con `<video>` |
| Hosting destino | Cloudflare Pages (build estático) |

Todo debe caber en los planes **gratuitos**. Ver §11 sobre la trampa del plan
gratuito de Supabase.

### Variables de entorno (`frontend/.env`)

```
VITE_SUPABASE_URL=https://<TU-PROJECT-REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key — es pública, viaja en el frontend>
```

> Las variables `VITE_CLOUDINARY_*` del plan original **ya no se usan** (ADR-002).
> Las credenciales de R2 viven solo como secrets de Edge Functions.

---

## 4. Estructura real del repositorio

```
C:\puranota\
  CLAUDE.md                  ← este documento (fuente de verdad)
  README.md                  ← presentación del proyecto y cómo correrlo
  backend/
    aula_cr_fase1_schema.sql ← SQL original (desactualizado, ver §6)
  supabase/functions/
    firmar-subida/           ← firma URL PUT a R2 (imágenes/PDF 10 MB, video 200 MB)
    borrar-archivo/          ← borra objetos de R2 (limpieza)
    recuperar-clave/         ← pregunta de seguridad (deploy --no-verify-jwt)
    resetear-clave-estudiante/
    cambiar-correo/
  docs/
    PLAN.md                  ← plan de trabajo y decisiones cerradas
    ADR.md                   ← historial de decisiones (ADR-001 … ADR-006)
    keep-alive.md            ← cómo evitar que Supabase se pause (ver §11)
    mep/                     ← reglamento REAC 2026 (PDF + texto + notas)
  imagenes/                  ← referencia visual de diseño (Aula Virtual UISIL)
  scripts/
    keep-alive-supabase.ps1  ← ping local por tarea programada de Windows
    keep-alive.log
  .github/workflows/keep-alive.yml   ← (inactivo: el repo no está en GitHub)
  frontend/
    index.html  vite.config.js  tailwind.config.js  postcss.config.js
    public/favicon.svg, reglamento-mep-2026.pdf
    src/
      main.jsx  App.jsx  index.css
      lib/          ← lógica pura, sin red
        supabase.js         (único lugar donde se crea el cliente)
        notas.js            ★ CÁLCULO DE NOTAS (§7)
        mep.js              ★ normativa MEP como datos (§8)
        periodos.js         periodos + calendario lectivo
        entregas.js  formato.js  markdown.js  youtube.js  tema.js
        preguntas-seguridad.js
      context/AuthContext.jsx
      services/     ← ÚNICA capa que habla con Supabase
        auth.service.js       perfil.service.js     grupos.service.js
        asignaciones.service.js  entregas.service.js  clases.service.js
        asistencia.service.js    anuncios.service.js  storage.service.js
      components/
        Layout.jsx Tabs.jsx Modal.jsx Alerta.jsx Cargando.jsx Volver.jsx
        ProtectedRoute.jsx AuthShell.jsx CampoContrasena.jsx MenuAcciones.jsx
        EstadoVacio.jsx SkeletonLista.jsx GaleriaArchivos.jsx
        ClaseContenido.jsx Logo.jsx
        docente/  GrupoForm RubrosEditor AsignacionesPanel AsignacionForm
                  RubricaEditor RevisionAsignacion AsistenciaPanel ClasesPanel
                  ClaseForm EstudiantesPanel PrematriculaPanel CodigoAcceso
                  NotasPanel AvisosModal
        estudiante/ NotasEstudiante
      pages/
        Login Registro Onboarding OlvideContrasena Restablecer
        MiCuenta CambiarClaveObligatorio NoEncontrado
        docente/    Dashboard  GrupoDetalle  Revision
        estudiante/ Dashboard  Grupo  Asignacion
```

---

## 5. Arquitectura del frontend

### 5.1 Capa de servicios (regla dura)

`components/` y `pages/` **nunca** importan `lib/supabase.js`. Piden datos a
`services/*.service.js`, que son las únicas que hacen `supabase.from(...)`,
`supabase.rpc(...)` o `supabase.functions.invoke(...)`.

Cada servicio: lanza `Error` con mensaje en español, normaliza formas de datos
raras (por ejemplo `rubrosPorPeriodo()` acepta el formato viejo y el nuevo) y no
tiene estado.

`lib/` es **lógica pura sin red** (cálculos, formatos, constantes). Se puede
razonar y probar sin base de datos. **Todo el cálculo de notas vive en
`lib/notas.js`** — nunca en un componente.

### 5.2 Sesión y rutas

`context/AuthContext.jsx` expone: `session`, `usuario`, `perfil`, `cargando`,
`esDocente`, `onboardingCompleto`, `debeCambiarClave`, `refrescarPerfil()`.

Rutas (`App.jsx`):

| Ruta | Quién |
|---|---|
| `/` | redirige según sesión → onboarding → cambio forzado de clave → rol |
| `/login`, `/registro`, `/olvide` | solo invitados |
| `/restablecer` | **fuera de `SoloInvitados`** (el token del correo crea una sesión temporal de recovery; si no, expulsaba al usuario y quedaba página en blanco) |
| `/onboarding` | con sesión, sin onboarding completo |
| `/cambiar-clave` | con sesión y `debe_cambiar_clave = true` |
| `/cuenta` | cualquiera logueado |
| `/docente`, `/docente/grupos/:id`, `/docente/asignaciones/:id` | rol docente |
| `/estudiante`, `/estudiante/grupos/:id`, `/estudiante/asignaciones/:id` | rol estudiante |

El **rol docente se asigna a mano en la base** (`perfiles.rol = 'docente'`).
Todo usuario nuevo nace como `estudiante`.

### 5.3 Layout, navegación y UI

- `Layout` tiene prop `ancho` (valores reales en `Layout.jsx`):
  `normal` y `amplio` → `max-w-[1680px]` (dashboards y detalle de grupo con barra
  lateral), `medio` → `max-w-6xl`, `estrecho` → `max-w-4xl` (formularios y vistas
  de lectura en una columna).
  *(Nota: el README habla de 1440/1400px — eso quedó viejo, mandan estos valores.)*
- **Navegación de grupo** (docente y estudiante): barra lateral fija en
  escritorio, pastillas que envuelven en móvil. `Tabs` soporta `orientacion`
  `horizontal` / `vertical` / `wrap` / `menu`.
- La pestaña activa del grupo se recuerda en `sessionStorage`
  (`pn-docente-grupo-tab-<id>`), así volver de Revisión no te tira a Estudiantes.
- `Volver` reemplaza los enlaces de texto "← …".
- Tablas anchas (Notas, resumen de Asistencia) se muestran como **tarjetas en
  móvil** y **tabla en escritorio**.
- Los avisos importantes van en **modal al accionar**, no en cajas grandes
  permanentes.

### 5.4 Diseño — "cuaderno escolar costarricense"

La app reemplaza el cuaderno que se pierde y se ve como uno bien cuidado.

Paleta en variables CSS (`index.css`), en canales RGB para usarse con
`rgb(var(--x) / alpha)`. **Tema oscuro por defecto**, se voltea con
`html[data-theme='dark']` y el botón 🌙.

| Token | Claro | Oscuro |
|---|---|---|
| `--c-papel` (fondo) | `#F7F5EF` | `#191D26` |
| `--c-tinta` (texto) | `#26241F` | `#E9ECF3` |
| `--c-superficie` (tarjeta) | blanco | `#272E3A` |
| `--c-pizarra` (primario) | `#176B4D` | `#3CD0A7` |
| `--c-guaria` (acento) | `#8A4FBE` | `#BB92F0` |
| `--c-margen` (rojo cuaderno) | `#E2574C` | `#F67A70` |

**Regla dura: nunca usar `bg-white` ni colores fijos.** Siempre los tokens
(`bg-superficie`, `text-tinta`, `border-tinta/15`…), o el tema oscuro se rompe.

- Tipografía: display **Bricolage Grotesque** (títulos, logo "PuraNota✓"), cuerpo
  **Instrument Sans**.
- Clases utilitarias en `index.css`: `.tarjeta-cuaderno`, `.con-margen` (la línea
  roja de margen, **solo** donde se marque), `.hoja-rayada`, `.btn-primario`,
  `.btn-secundario`, `.btn-accion`, `.campo`, `.etiqueta`.
- Sobrio y funcional. Bordes 10–14px. Nada de gradientes ni glassmorphism.
- Accesible: foco visible, contraste AA, respeta `prefers-reduced-motion`.

---

## 6. Base de datos (Supabase / Postgres)

Proyecto: **`<TU-PROJECT-REF>`** · región `us-east-1` · Postgres 17 · plan **free**.

**Volumen real hoy (2026-07-25):** 3 perfiles, 1 grupo, 2 asignaciones, 2 entregas.
O sea, **son datos de prueba, no producción con estudiantes reales todavía**. Eso
importa: una migración de datos hoy es barata, en marzo no lo va a ser.

Todas las tablas están en el esquema `public` y **todas tienen RLS activo**.

### 6.1 Tablas y columnas

> ✅ Esto se **verificó contra la base real el 2026-07-25**, no contra el SQL.
>
> ⚠️ `backend/aula_cr_fase1_schema.sql` tiene solo el estado original. Las
> columnas marcadas **(+)** se agregaron después a mano y **no están en ese SQL**.

**`perfiles`** — se crea sola por trigger al registrarse (`on_auth_user_created`).
`id` (= `auth.users.id`), `correo`, `nombre`, `telefono`, `seccion`,
`rol` `'docente'|'estudiante'`, `onboarding_completo`, `creado_en`,
**(+)** `pregunta_seguridad`, **(+)** `respuesta_hash`, **(+)** `debe_cambiar_clave`.

**`grupos`** —
`id`, `docente_id`, `nombre`, `materia`, `nivel`, `anio`, `codigo_acceso` (único,
6 caracteres, autogenerado), `requiere_aprobacion`, `activo`, `creado_en`,
`periodo`, `rubros` jsonb,
**(+)** `especialidad`, **(+)** `mep_modalidad`, **(+)** `periodos_fechas` jsonb,
**(+)** `penalizacion_tardia` y **(+)** `anuncio` — **columnas muertas**: existen en
la base pero **ningún código las lee ni las escribe** (la penalización quedó por
asignación y los avisos se movieron a la tabla `anuncios`). No usarlas; borrarlas
algún día.

Dos columnas con significado **reinterpretado** (ADR-001) — ojo acá:

- **`periodo`** ya **no** guarda "I Periodo": guarda la **cantidad de periodos**
  del grupo como texto, `"2"` o `"3"`. Cualquier otro valor cae a 2
  (`lib/periodos.js → cantidadPeriodos`).
- **`rubros`** ya **no** es un arreglo plano: es un objeto **agrupado por periodo**.
  ```json
  { "I":  [{"nombre":"Trabajo cotidiano","porcentaje":45},
           {"nombre":"Tareas","porcentaje":10},
           {"nombre":"Pruebas","porcentaje":40},
           {"nombre":"Asistencia","porcentaje":5,"asistencia":true,
            "tardiasPorAusencia":2,"justificadaCuenta":true,"mep":true}],
    "II": [...], "III": [...] }
  ```
  Cada periodo suma **100 por separado** (incluyendo la asistencia).
  `grupos.service.js → rubrosPorPeriodo(grupo)` **también lee el formato viejo**
  (arreglo plano = rubros del I Periodo) para no romper grupos antiguos.
- **`periodos_fechas`** jsonb: `{ "I": {"inicio":"2026-02-01","fin":"2026-07-07"}, … }`.
  Solo se usa para acotar la asistencia por periodo. Si está vacío se usa un
  reparto sugerido del año lectivo (§8.3).
- **`mep_modalidad`**: clave de preset de `lib/mep.js` (`'academico-iii'`, `'dual'`,
  `'coned'`…) o `null` si el grupo no usa Modo MEP.

**`grupo_estudiantes`** — `grupo_id`, `estudiante_id`, `estado` `'activo'|'pendiente'`,
`creado_en`. Único `(grupo_id, estudiante_id)`.

**`prematriculas`** — `grupo_id`, `correo`, `usado`. Único `(grupo_id, correo)`.
Al registrarse un correo pre-matriculado, un trigger lo mete al grupo solo.

**`asignaciones`** —
`id`, `grupo_id`, `titulo`, `instrucciones`, `rubro` (**texto, no FK**),
`puntos` numeric, `fecha_limite` timestamptz, `permite_tardias`,
`rubrica` jsonb `[{criterio,puntos}]`, `visible`, `creado_en`,
**(+)** `periodo` `'I'|'II'|'III'`, **(+)** `porcentaje` numeric,
**(+)** `penalizacion_tardia` numeric, **(+)** `requiere_entrega` boolean,
**(+)** `clase_id` uuid, **(+)** `archivos` jsonb `[{url,nombre,tipo}]`,
**(+)** `tipo` `'entrega'|'prueba'|'proyecto'|'foro'` (default `'entrega'`).

- `puntos` = escala con la que se califica (ej. sobre 10, sobre 40).
- **`porcentaje`** = cuánto vale esta asignación **del 100 del periodo**, dentro
  del presupuesto de su rubro. **Es la columna clave del cálculo de notas** (§7).
- `penalizacion_tardia` = % que se le rebaja a la nota si la entrega fue tardía.
- `requiere_entrega = false` → prueba escrita / nota directa: el estudiante no
  sube nada y el docente califica directo. **Ojo con el bug de §7.6.**
- `archivos` = material que el docente adjunta a la asignación (va en la propia
  fila como jsonb, no en tabla aparte).

**`entregas`** — `asignacion_id`, `estudiante_id`,
`estado` `'entregada'|'pre_revisada'|'calificada'`, `tardia` (la pone un trigger),
`nota` numeric, `observaciones`, `entregado_en`, `calificado_en`.
Único `(asignacion_id, estudiante_id)`.

**`entrega_archivos`** — `entrega_id`, `url`, `nombre`, `tipo`.

**`clases`** — `grupo_id`, `titulo`, `contenido` (markdown simple), `orden`,
`visible`, `youtube_url` (legado, singular), **(+)** `youtube_urls` (array — **es
la que se usa hoy**: una clase puede llevar varios videos de YouTube).
**`clase_archivos`** — `clase_id`, `url`, `nombre`, `tipo`. Los de `tipo` `video/*`
son el video propio del docente (ADR-005) y se reproducen con `<video>`.

**`asistencia`** — `grupo_id`, `estudiante_id`, `fecha` date,
`estado` `'presente'|'ausente'|'tardia'|'justificada'`.
Único `(grupo_id, estudiante_id, fecha)`.

**`anuncios`** **(+ tabla nueva)** — `docente_id`, `contenido`, `grupo_ids` (array
de uuid), `creado_en`. Avisos del docente dirigidos a varios grupos.

**`revisiones_ia`**, **`config_ia`** — existen pero **vacías**: son de Fase 2.

### 6.2 Triggers

| Trigger | Qué hace |
|---|---|
| `on_auth_user_created` → `handle_new_user()` | crea la fila en `perfiles` al registrarse (vive en el esquema `auth`) |
| `on_perfil_created` → `aplicar_prematriculas()` | al crearse el perfil, lo mete a los grupos donde su correo estaba pre-matriculado |
| `on_prematricula_created` → `aplicar_prematricula_inmediata()` | si el docente pre-matricula un correo de alguien **ya registrado**, lo mete al grupo al toque |
| `on_entrega_insert` → `marcar_tardia()` | **BEFORE INSERT** en `entregas`: si `now() > asignaciones.fecha_limite`, pone `tardia = true` |

Funciones auxiliares que usan las políticas RLS: `es_docente()`,
`es_docente_de_grupo(uuid)`, `es_miembro_de_grupo(uuid)`.

⚠️ `marcar_tardia` corre **solo en INSERT**, nunca en UPDATE. Consecuencias en §7.6.

### 6.3 RPCs (`supabase.rpc(...)`)

- `unirse_con_codigo(p_codigo text) → jsonb {ok, mensaje|grupo, estado}` — el
  estudiante entra al grupo. No lanza error con código inválido: devuelve
  `ok:false` para mostrarlo como mensaje.
- `regenerar_codigo(p_grupo_id uuid) → text` — solo el docente dueño.

### 6.4 RLS — reglas que el frontend debe asumir

- **Estudiante:** solo ve/edita lo suyo. Entra a grupos solo por RPC o
  pre-matrícula. Puede crear/reemplazar su entrega **solo antes de la fecha
  límite y mientras no esté calificada**.
- **Docente:** control total sobre *sus* grupos, asignaciones, entregas, notas,
  asistencia y clases.
- Políticas agregadas después del SQL original:
  - **(+)** `"estudiante ve sus archivos"` en `entrega_archivos` — política
    **aditiva de solo lectura** (ADR-004). Sin ella, al calificar la entrega el
    estudiante dejaba de ver lo que había entregado. Las políticas se combinan con
    OR: puede **ver** siempre, pero **modificar** solo antes de calificar.
  - **(+)** `"docente crea entrega"` en `entregas` — necesaria para
    `calificarPorEstudiante` (nota directa sin entrega del estudiante).

### 6.5 Cambios de esquema aplicados a mano (en orden)

```sql
-- ADR-001
alter table public.asignaciones
  add column periodo text not null default 'I' check (periodo in ('I','II','III'));

-- ADR-003
alter table public.perfiles
  add column pregunta_seguridad text,
  add column respuesta_hash text,
  add column debe_cambiar_clave boolean not null default false;

-- ADR-004
create policy "estudiante ve sus archivos" on public.entrega_archivos
  for select using (exists (
    select 1 from public.entregas e
    where e.id = entrega_id and e.estudiante_id = auth.uid()));

-- ADR-006
alter table public.grupos
  add column periodos_fechas jsonb not null default '{}'::jsonb;

-- Modelo de notas por asignación + Modo MEP + material + nota directa
alter table public.asignaciones
  add column porcentaje numeric,
  add column penalizacion_tardia numeric not null default 0,
  add column requiere_entrega boolean not null default true,
  add column clase_id uuid references public.clases(id) on delete set null,
  add column archivos jsonb not null default '[]'::jsonb;
alter table public.grupos
  add column especialidad text,
  add column mep_modalidad text;
-- tabla anuncios + su RLS

-- 2026-07-25 — Tipo de actividad (PLAN.md D13). Enchufe de la columna "Tipo"
-- del registro y de los foros del bloque 2.
alter table public.asignaciones
  add column if not exists tipo text not null default 'entrega';
alter table public.asignaciones
  add constraint asignaciones_tipo_check
  check (tipo in ('entrega','prueba','proyecto','foro'));
update public.asignaciones set tipo = 'prueba'
 where requiere_entrega = false and tipo = 'entrega';
```

> **Tarea abierta:** regenerar `backend/aula_cr_fase1_schema.sql` desde la base
> real para que vuelva a ser un espejo fiel. Hoy no lo es.

---

## 7. ★ NOTAS Y CALIFICACIONES (la parte crítica)

> ## ⚠️ REESCRITO EL 2026-07-25 — leer `docs/PLAN.md` §3
>
> El modelo cambió al de un **registro académico formal** (referencia: Aula
> Virtual de la UISIL, capturas en `imagenes/`). Lo que sigue en §7.1–§7.5
> describe el modelo **viejo** y se conserva solo como historia. **Lo vigente:**
>
> **Vocabulario (3 palabras, iguales en código y en las dos pantallas):**
> - **Valor %** = `asignaciones.porcentaje` — cuánto vale la actividad del periodo.
> - **Calificación** = `(nota / puntos) × Valor %` — cuánto de ese valor obtuvo,
>   **expresado en porcentaje**, nunca en puntos crudos.
> - **NOTA FINAL** = **suma** de la columna Calificación. Un solo número.
>
> **Regla de oro:** la NOTA FINAL es la suma de lo que se ve en pantalla. Una
> fila que no cuenta (rubro inexistente o sin Valor %) muestra la pastilla
> «No cuenta», **no un número** — así la suma siempre cuadra.
>
> **Decimales:** REAC Art. 26 → 2 decimales en el periodo (`pct()` formatea
> `31,50%` en es-CR); solo el promedio anual se redondea (`redondearAnual`).
>
> **Dónde vive:** `lib/notas.js` → `calcularRegistro()` y `calificacionDe()`.
> **Quién lo muestra:** `components/estudiante/EvaluacionEstudiante.jsx` (registro
> del estudiante, reemplazó a `NotasEstudiante.jsx`) y
> `components/docente/NotasPanel.jsx` (registro del grupo).
>
> **Los bugs A, B y C de §7.6 ya están corregidos.**

Esta es la sección más importante del documento. Acá fue donde más se dio vueltas
y donde más fácil se rompe algo. **Todo el cálculo vive en un solo archivo:
`frontend/src/lib/notas.js`.** No lo dupliques en componentes.

### 7.1 El modelo mental, en una frase *(histórico — ver el recuadro de arriba)*

> El periodo vale **100 puntos**. Los **rubros** reparten esos 100 entre sí. Cada
> **asignación** se lleva un pedacito del porcentaje de su rubro. La nota de la
> asignación (`nota / puntos`) convierte ese pedacito en puntos ganados.

Tres niveles:

```
PERIODO (100%)
 └── RUBRO "Trabajo cotidiano" 45%          ← grupos.rubros[periodo]
      ├── Asignación "Cotidiano 1"  15%     ← asignaciones.porcentaje
      ├── Asignación "Cotidiano 2"  15%
      └── Asignación "Cotidiano 3"  15%     (los 15+15+15 no pueden pasar de 45)
 └── RUBRO "Tareas" 10%
 └── RUBRO "Pruebas" 40%
 └── RUBRO "Asistencia" 5%                  ← especial: no lleva asignaciones (§8)
```

**Decisión de diseño (importante):** el peso de cada asignación es explícito
(`asignaciones.porcentaje`), **no** se reparte por promedio simple. Así el docente
decide que un examen pese más que un quiz sin inventar puntajes raros. El
formulario de asignación muestra "disponible" y **no deja pasarse del presupuesto
del rubro**.

### 7.2 De dónde sale cada dato

| Dato | Dónde vive | Quién lo escribe |
|---|---|---|
| Rubros y sus % | `grupos.rubros` (jsonb por periodo) | `RubrosEditor` → `guardarRubros()` |
| % de una asignación | `asignaciones.porcentaje` | `AsignacionForm` |
| Escala de calificación | `asignaciones.puntos` | `AsignacionForm` |
| Rebaja por tardía | `asignaciones.penalizacion_tardia` | `AsignacionForm` |
| Nota puesta | `entregas.nota` + `estado='calificada'` | `RevisionAsignacion` → `calificarEntrega()` / `calificarPorEstudiante()` |
| ¿Fue tardía? | `entregas.tardia` | trigger `marcar_tardia()` en la base |
| Asistencia | tabla `asistencia` | `AsistenciaPanel` |
| Fechas del periodo | `grupos.periodos_fechas` (o sugeridas) | `PeriodosFechas` |

**El vínculo asignación ↔ rubro es por NOMBRE de texto**, no por id.
`asignaciones.rubro === rubro.nombre`. Esto es frágil a propósito (es lo simple),
y por eso existen dos salvavidas — ver §7.5.

### 7.3 Las fórmulas exactas (`calcularNotasPeriodo`)

Firma:
```js
calcularNotasPeriodo(rubros, asignaciones, entregaDeAsignacion, asistenciaConteos)
// → { porRubro: [...], lleva, promedio }
```

**Para cada rubro normal**, sobre sus asignaciones **calificadas**
(`entrega.estado === 'calificada' && entrega.nota != null && asignacion.puntos > 0`):

```
frac      = nota / puntos
si tardía y penalizacion_tardia > 0:
            frac = frac × (1 − penalizacion_tardia/100)
aporte        += frac × asignacion.porcentaje      ← puntos ganados sobre el 100 del periodo
pesoCalificado += asignacion.porcentaje            ← cuánto del periodo ya se evaluó
```

y de ahí:

| Campo devuelto | Fórmula | Significado |
|---|---|---|
| `puntos` | `aporte` | puntos que el rubro ya aporta al 100 del periodo |
| **`promedio`** | `aporte / pesoCalificado × 100` | **nota 0-100 del rubro sobre lo ya calificado ← es lo que se muestra** |
| `nota` | `aporte / porcentajeRubro × 100` | nota "acumulada" sobre el peso completo del rubro (existe por si se necesita; hoy no se muestra) |
| `calificadas` / `total` | conteo | "3 de 5 calificadas" |

**Para el rubro de asistencia** (§8): su nota 0-100 sale del registro de
asistencia, `puntos = nota × %/100`, y su `pesoCalificado` es su % completo.

**Total del periodo:**
```
lleva    = Σ puntos de los rubros con nota          (acumulado real sobre 100)
pesoTot  = Σ pesoCalificado de esos rubros
promedio = lleva / pesoTot × 100                     ← lo que se muestra
```

**Por qué se muestra el `promedio` y no el `lleva`:** el acumulado arranca en
números bajísimos (en marzo llevás 12 de 100) y asusta al estudiante. El promedio
renormalizado responde la pregunta real: *"¿qué nota llevo con lo que ya me
calificaron?"*. Lo que aún no se califica **no castiga**.

> Si algún día se quiere lo contrario (lo no calificado cuenta como 0), se cambia
> **solo** `calcularNotasPeriodo`: usar `porcentajeRubro` en vez de
> `pesoCalificado` como divisor. Un solo lugar.

### 7.4 Ejemplo numérico completo (usalo para verificar cambios)

Grupo de 2 periodos, I Periodo con rubros:
Trabajo cotidiano **45%**, Tareas **10%**, Pruebas **40%**, Asistencia **5%**.

| Asignación | Rubro | % | Puntos | Nota | Estado |
|---|---|---|---|---|---|
| Cotidiano 1 | Trabajo cotidiano | 15 | 10 | 8 | calificada |
| Cotidiano 2 | Trabajo cotidiano | 15 | 20 | — | sin calificar |
| Tarea 1 | Tareas | 10 | 5 | 4 | calificada, **tardía**, penalización 10% |
| Examen 1 | Pruebas | 40 | 100 | — | sin calificar |

Asistencia del periodo: 18 presentes, 2 ausentes, 0 tardías (regla lineal).

```
Trabajo cotidiano: frac = 8/10 = 0.80 → aporte = 0.80 × 15 = 12
                   pesoCalificado = 15
                   promedio = 12/15 × 100 = 80

Tareas:            frac = 4/5 = 0.80 → tardía −10% → 0.72
                   aporte = 0.72 × 10 = 7.2 ; pesoCalificado = 10
                   promedio = 72

Pruebas:           sin calificar → promedio null ("—"), no pesa

Asistencia:        (20 − 2)/20 × 100 = 90 → puntos = 90 × 5/100 = 4.5
                   pesoCalificado = 5 ; promedio = 90

lleva    = 12 + 7.2 + 4.5 = 23.7
pesoTot  = 15 + 10 + 5    = 30
PROMEDIO DEL PERIODO = 23.7 / 30 × 100 = 79
```

Ese **79** es el número grande que ven docente y estudiante. Si tocás `notas.js`,
corré este ejemplo mentalmente antes de dar por bueno el cambio.

### 7.5 Los dos salvavidas del vínculo por nombre

Como asignación → rubro se une por texto, renombrar o borrar un rubro puede
desconectar notas **en silencio**. Por eso:

1. **Renombrar propaga en cascada.** `RubrosEditor` recuerda el nombre original de
   cada fila (`orig`) y al guardar llama
   `renombrarRubroEnAsignaciones(grupoId, periodo, de, a)`, que hace el UPDATE
   masivo. Antes de guardar muestra un **modal de confirmación** con cuántas
   actividades se mueven.
2. **Huérfanas visibles.** `asignacionesHuerfanas(rubros, asignaciones)` detecta
   asignaciones cuyo rubro ya no existe. `NotasPanel` (docente) y
   `NotasEstudiante` muestran una alerta: *"sus notas no se están contando"*.
   Nunca se pierde algo sin avisar.

Validaciones del `RubrosEditor` que **no** hay que aflojar:
- cada rubro necesita nombre y % > 0;
- **no puede haber dos rubros con el mismo nombre** (si no, la misma asignación
  contaría dos veces);
- "Asistencia" no se puede usar como rubro normal (es el especial);
- la suma del periodo, **incluida la asistencia**, debe dar exactamente **100**.

Además, la configuración de asistencia es **global al grupo** (igual en todos los
periodos), aunque el editor la muestre dentro de cada periodo.

### 7.6 Bugs del módulo de notas — ✅ A, B y C CORREGIDOS el 2026-07-25

Se dejan escritos porque explican **por qué** el código es como es hoy; si alguien
"simplifica" estas guardas, los bugs vuelven.

- **(A) corregido** en `calificacionDe()`: la penalización por tardía solo se
  aplica si `requiere_entrega !== false`.
- **(B) corregido** en `motivoNoCuenta()`: una actividad sin `porcentaje` se marca
  `sin_valor`, se avisa en pantalla y no se le muestra número.
- **(C) corregido**: la leyenda del registro del docente ahora describe lo que
  realmente muestra (celda = calificación en % del periodo; Nota = suma de la fila).
- **(D), (E) y (F)** siguen vigentes tal como están descritos abajo.

**(A) Penalización fantasma en notas directas.**
`marcar_tardia()` es un trigger **BEFORE INSERT**. `calificarPorEstudiante()`
(nota directa, `requiere_entrega = false`) **crea** la fila de `entregas` al
calificar. Si el docente califica después de la `fecha_limite`, el trigger marca
`tardia = true`. Y como `AsignacionForm` guarda `penalizacion_tardia = 10` por
defecto aunque el bloque de tardías esté oculto para asignaciones sin entrega, la
nota se rebaja **10% sola, sin que nadie lo pida**.
*Arreglos posibles:* forzar `penalizacion_tardia = 0` cuando
`requiere_entrega = false` en `limpiarDatos()`; y/o ignorar `tardia` en
`notas.js` cuando la asignación no requiere entrega; y/o que el trigger no marque
tardía si quien inserta es el docente.
*Estado hoy (verificado en la base 2026-07-25):* **0 filas afectadas** todavía —
es un bug latente que aparece en cuanto se use una prueba escrita con fecha límite.

**(B) Asignaciones con `porcentaje` NULL no cuentan y no se nota.**
La columna es nullable y hay filas viejas creadas antes de que existiera. En
`calcularNotasPeriodo`, `porcentaje` null → `aporte += 0` y `pesoCalificado += 0`
→ el rubro muestra `—` aunque tenga entregas calificadas. El formulario ya exige
% > 0 para lo nuevo, pero los datos viejos siguen ahí.
*Arreglos posibles:* contarlas como huérfanas y avisar igual que en §7.5, o correr
un UPDATE que reparta el % del rubro entre sus asignaciones sin porcentaje; lo
más limpio sería `alter table asignaciones alter column porcentaje set not null`
después de limpiar.
*Estado hoy (verificado en la base 2026-07-25):* **0 filas con `porcentaje` null**
—el riesgo sigue abierto porque la columna es nullable.

**(C) El texto al pie del cuadro del docente no dice lo que se muestra.**
`NotasPanel.jsx` cierra con *"Cada celda es el **porcentaje que aporta** ese
rubro; la **Nota** es la suma de todos"*, pero las celdas muestran `r.promedio`
(0-100 renormalizado) y la Nota muestra el `promedio` del periodo, **no** la suma
de aportes. Los números están bien; **la leyenda está mal** y hace desconfiar del
cuadro. *Arreglo:* cambiar el texto a "cada celda es la nota 0-100 del rubro sobre
lo ya calificado; la Nota es el promedio ponderado de esas notas".

**(D) Docente y estudiante deben mostrar siempre lo mismo.**
Hoy ambos usan `promedio` (§7.3) y coinciden. Si cambiás uno, cambiá el otro:
`NotasPanel.jsx` y `NotasEstudiante.jsx`. Que el estudiante vea un número distinto
al del profe es el peor bug posible de este módulo.

**(E) `NotasPanel` trae toda la asistencia del grupo y filtra en el cliente.**
`listarAsistenciaGrupo(grupoId)` sin rango. Con años completos y muchos
estudiantes esto crece. Funciona hoy; si se pone lento, filtrar por rango en el
servidor.

**(F) Los rubros de un periodo se guardan sobrescribiendo el jsonb completo.**
`guardarRubros` reemplaza `{I, II, III}` entero. `RubrosEditor` reconstruye los
tres periodos antes de guardar. Si alguien llama `guardarRubros` con un objeto
parcial, **borra los otros periodos**.

### 7.7 Cómo probar notas a mano

1. Crear grupo de 2 periodos → pestaña **Rubros** → rubros del I que sumen 100.
2. Crear 2 asignaciones en el mismo rubro con % distintos; comprobar que el
   formulario **no deja** pasarse del presupuesto ("disponible").
3. Matricular un estudiante, que entregue una y no la otra.
4. Calificar la entregada → **Notas** (docente) debe mostrar el rubro con el
   promedio de lo calificado y "1 de 2".
5. Entrar como estudiante → su nota debe ser **idéntica** a la del docente.
6. Entregar tarde una con penalización → verificar la rebaja.
7. Renombrar el rubro en Rubros → confirmar el modal → las notas **siguen contando**.
8. Borrar el rubro → debe aparecer la alerta de huérfanas y el total debe bajar.
9. Activar asistencia 5%, pasar lista varios días → la nota se mueve sola.

---

## 8. Asistencia y Modo MEP

### 8.1 Asistencia como rubro (ADR-006)

La asistencia puede contar para la nota como **un rubro más que se calcula solo**.
Vive dentro de `grupos.rubros` como una entrada con campos extra:

```json
{"nombre":"Asistencia","porcentaje":5,"asistencia":true,
 "tardiasPorAusencia":2,"justificadaCuenta":true,"mep":true}
```

Cálculo (`lib/notas.js → notaAsistencia`):

```
ausencias = ausentes + tardías / tardiasPorAusencia
            (+ justificadas, si justificadaCuenta === false)
nota      = (total − ausencias) / total × 100        ← modo lineal
```

Con `mep: true` no es lineal: se usa la **escala escalonada del Art. 37**
(`lib/mep.js → ESCALA_ASISTENCIA`), por tramos del % de ausencias injustificadas:
`<10% → 100`, `<20% → 80`, `<30% → 60`, `<40% → 40`, `<50% → 20`, resto `0`.
Para un rubro de 5%, eso da la escala oficial 5 / 4 / 3 / 2 / 1 / 0.

Además del rubro, al estudiante se le muestra un **% de asistencia "crudo"** de
referencia (`porcentajeAsistencia`: solo las ausencias lo bajan), separado de la
nota del rubro.

### 8.2 Modo MEP (`lib/mep.js`)

La normativa está como **datos versionados y editables**, no como lógica. Fuente:
REAC, decreto 45509-MEP, vigente desde el curso lectivo 2026
(`docs/mep/`, PDF servido en `/reglamento-mep-2026.pdf`).

- `UMBRAL = { egb: 65, diversificada: 70 }` (Art. 47) — **no es 75**, eso fue un
  error de prensa. Se usa para pintar verde/rojo en el cuadro de notas.
- `MIN_ASISTENCIA_AMPLIACION = 0.8` (Art. 54) — el estudiante ve su % de presencia
  contra ese mínimo.
- `PRESETS` — rubros oficiales por modalidad: `academico-i-ii`, `academico-iii`,
  `academico-diver`, `tecnico-nocturno`, `dual`, `cindea-i/ii/iii`, `coned`
  (esta última **sin asistencia**).
- `rubrosCompletosDeModalidad(clave, periodos)` arma `{I,II,III}` listo para
  guardar, con la asistencia del MEP incluida.

**Si el reglamento cambia, se editan esos números — no la lógica.** Y el docente
siempre puede sobrescribir lo que el preset pre-llenó: el Modo MEP es un punto de
partida, no un candado.

### 8.3 Fechas de periodo

`rangoPeriodo(grupo, periodo)` decide el rango para contar asistencia:
1. si el docente cargó fechas en `grupos.periodos_fechas`, esas;
2. si no, **reparte el año lectivo en partes iguales**
   (`CALENDARIO_LECTIVO` en `lib/periodos.js`: 1 de febrero → 15 de diciembre).

Así la asistencia por periodo funciona sola aunque el profe nunca entre a
configurarla. Si el MEP mueve el calendario, se edita solo esa constante.

---

## 9. Archivos: Cloudflare R2 (ADR-002 / ADR-005)

R2 no permite subida anónima, así que el flujo usa **URL pre-firmada**:

```
Usuario logueado
 → storage.service.js comprime la imagen (máx 1600px, ~2 MB)
 → invoca la Edge Function `firmar-subida` (verifica la sesión)
 → PUT DIRECTO a R2 con la URL firmada (XHR, con barra de progreso)
 → guarda la URL pública en la base (entrega_archivos / clase_archivos / asignaciones.archivos)
```

- Ruta del objeto en R2: `{carpeta}/{grupo}/{usuario}/…` con
  `carpeta ∈ {entregas, clases, asignaciones}`.
- Límites: **10 MB** imágenes/PDF (`image/jpeg|png|webp`, `application/pdf`),
  **200 MB** video (`video/mp4` recomendado, `webm`, `quicktime`).
- Secrets de la Edge Function (nunca en el frontend): `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE`.
- `borrar-archivo` limpia los objetos al borrar entregas/clases/grupos
  (best-effort: si falla, la base sigue siendo la fuente de verdad).
- **Limitación conocida:** al borrar una *asignación*, los archivos que subieron
  los estudiantes quedan huérfanos en R2 (la regla de seguridad no deja al docente
  borrar objetos de otro usuario).

Para cambiar de proveedor de almacenamiento se toca **un solo archivo**:
`services/storage.service.js`.

### Edge Functions desplegadas

| Función | Deploy | Qué hace |
|---|---|---|
| `firmar-subida` | `supabase functions deploy firmar-subida` | firma la URL PUT a R2 (incluye video) |
| `borrar-archivo` | normal | borra objetos de R2 del propio usuario |
| `recuperar-clave` | **`--no-verify-jwt`** | pregunta de seguridad (acciones sin sesión) |
| `resetear-clave-estudiante` | normal | el docente genera clave temporal |
| `cambiar-correo` | normal | cambio de correo del usuario |

---

## 10. Contraseñas (ADR-003)

Cuatro caminos, porque el correo gratuito de Supabase es lento y los estudiantes
olvidan la clave:

1. **Cambiar estando logueado** (`/cuenta`): pide la actual (re-autentica) y la nueva.
2. **Pregunta de seguridad**: se define en el onboarding (lista fija en
   `lib/preguntas-seguridad.js`). En login → "Olvidé mi contraseña" → correo →
   se muestra su pregunta → responde → entra con clave nueva.
   La respuesta **nunca se guarda en texto plano**: se normaliza (minúsculas +
   trim) y se hashea con **PBKDF2-SHA256 + salt** dentro de la Edge Function
   (`pbkdf2$iter$salt$hash`).
3. **Correo de recuperación**: `resetPasswordForEmail` → ruta `/restablecer`.
   Requiere configurar en Supabase → Auth → URL Configuration el Site URL y los
   Redirect URLs (`http://localhost:5173/restablecer` + los de producción).
4. **Reset por el docente**: genera una temporal y la muestra para dictarla.
   Marca `debe_cambiar_clave = true` → el estudiante es forzado a `/cambiar-clave`.

El docente **nunca ve contraseñas** (son hash irreversible), solo resetea.
Cambiar la clave de otro usuario o sin sesión requiere `service_role` → siempre
en Edge Function.

---

## 11. ⚠️ Que Supabase NO se vuelva a pausar

**Qué pasó.** El plan gratuito pausa proyectos con poca actividad en 7 días.
El proyecto se pausó alrededor del **2026-07-22**. Se restauró el 2026-07-25.

**Por qué falló lo que ya había** — esto es lo importante, porque *parecía* estar
funcionando:

1. La **tarea programada de Windows** (`scripts/keep-alive-supabase.ps1`) **sí
   corrió**: el log muestra `OK HTTP 200` casi todos los días hasta el 21 de julio,
   y el 22 ya no resolvía el DNS (o sea, ya estaba pausado). **Un ping por día no
   alcanzó.** La documentación de Supabase dice *"típicamente unas pocas
   solicitudes a la base por día"* — una sola consulta diaria queda en el filo.
2. La **GitHub Action** (`.github/workflows/keep-alive.yml`) **nunca corrió**: el
   proyecto **no es un repositorio git** y no está en GitHub. Ese archivo es
   decorativo hoy.
3. Además, la tarea de Windows solo corre con la PC encendida.

**Qué hacer (en orden de recomendación):**

- ✅ **Recomendado — monitor externo cada 5 minutos.** Crear en
  [UptimeRobot](https://uptimerobot.com) (gratis) un monitor HTTP(s) a:
  ```
  https://<TU-PROJECT-REF>.supabase.co/rest/v1/grupos?select=id&limit=1&apikey=<ANON_KEY>
  ```
  Intervalo 5 min. Eso son ~288 consultas reales a Postgres por día: la
  inactividad deja de ser discutible, y además avisa por correo si el proyecto se
  cae. La `anon key` en la URL no es un riesgo: ya es pública (viaja en el
  frontend). **Probá la URL en el navegador primero:** tiene que devolver `200` y
  un JSON (`[]` está bien).
- **Segundo respaldo — [cron-job.org](https://cron-job.org)**, gratis, cada 6
  horas, misma URL (o con headers `apikey` y `Authorization: Bearer <anon key>`).
  Dos servicios independientes es lo que hace que esto no vuelva a pasar.
- **Dejar la tarea de Windows** como tercer respaldo, pero **subiendo la
  frecuencia** (cada 6 h en vez de diaria). No depender de ella.
- **Revisar el correo de aviso.** Supabase manda un correo ~1 semana antes de
  pausar. Con abrir el dashboard una vez ya se evita.
- **La única garantía real es el plan Pro (US$25/mes):** los proyectos de pago no
  se pausan nunca. Si PuraNota va a usarse con estudiantes de verdad, es el paso
  correcto.

**Si vuelve a pasar:** hay **90 días** para restaurar sin perder nada, desde el
dashboard → *Resume project* (o `restore_project` por API). Tarda unos minutos y
los datos vuelven intactos.

---

## 12. Cómo correr y probar

```powershell
cd C:\puranota\frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # build estático para Cloudflare Pages
```

Edge Functions:
```powershell
cd C:\puranota
supabase functions deploy firmar-subida
supabase functions deploy recuperar-clave --no-verify-jwt
```

Recorrido de prueba de punta a punta:

1. **Auth** — registrarse, confirmar correo, onboarding (nombre, teléfono de 8
   dígitos, sección, pregunta de seguridad) → redirige según rol.
2. **Grupos** — crear grupo, ver y copiar el código, regenerarlo, rubros que sumen
   100, pre-matricular correos en lote, aprobar/expulsar estudiantes.
3. **Asignaciones** — crear con periodo, rubro, %, puntos, fecha límite, rúbrica,
   material adjunto, visible/oculta.
4. **Estudiante** — unirse con código, ver próximas entregas, subir fotos/PDF,
   reemplazar antes de la fecha, ver estado.
5. **Revisión** — filtros por estado, abrir la entrega, visor de imágenes/PDF,
   poner nota (validada contra los puntos) y observaciones, re-calificar.
6. **Asistencia** — pase de lista de hoy, botones P/A/T/J, resumen por estudiante.
7. **Clases** — crear con markdown, YouTube o video propio, adjuntos; verlas como
   estudiante.
8. **Notas** — el recorrido completo de §7.7.

---

## 13. Pendientes conocidos

**De notas (§7.6):** penalización fantasma en notas directas (A), asignaciones con
`porcentaje` NULL (B), leyenda equivocada en el cuadro del docente (C).

**De infraestructura:** montar el keep-alive externo (§11); regenerar
`backend/aula_cr_fase1_schema.sql` desde la base real; el repo **no está en git**
(no hay historial ni respaldo — conviene `git init` + remoto privado).

**De producto (pedidos para después):** SMTP propio para que los correos de
recuperación sean confiables; export a Excel; notificaciones; bitácora.

**Fase 2:** Edge Function + Gemini para pre-revisión de entregas
(`revisiones_ia`, `config_ia` ya existen vacías). **No construir todavía.**
