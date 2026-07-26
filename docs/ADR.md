# PuraNota — Decisiones de arquitectura (ADRs)

> ⚠️ **La fuente de verdad del proyecto es [`CLAUDE.md`](./CLAUDE.md)**, que
> describe el sistema completo tal como está hoy (esquema real, cálculo de notas,
> infraestructura). Este archivo es el **historial de decisiones**: sirve para
> entender *por qué* se llegó acá. **Si algo se contradice, manda `CLAUDE.md`.**

Este documento registra decisiones de diseño que **no** se derivan solas del
código ni del esquema de la base. Es un documento **vivo**: si una decisión
cambia, se edita aquí y se ajusta el código en consecuencia.

> Convención: cada decisión tiene **Estado** (Acordado / En revisión / Descartado),
> la fecha, el porqué, y cómo se implementa. Para cambiar algo, editá la sección
> y dejá el motivo del cambio.

---

## ADR-001 — Evaluación por periodos dentro de un mismo grupo

**Estado:** Acordado · 2026-06-13

### Problema

Un grupo debe abarcar **todo el año lectivo** y evaluarse por periodos
(I, II, III). No se debe crear un grupo nuevo por periodo: todo vive en el
mismo grupo y el docente solo cambia de periodo en la interfaz.

El esquema original modelaba el periodo como un único campo de texto en el
grupo (`grupos.periodo`), lo que obligaba a un grupo por periodo. Esta decisión
lo corrige.

### Decisiones tomadas

1. **El periodo pasa a vivir en las asignaciones, no en el grupo.**
   Se agrega una columna `periodo` a `asignaciones`. _(Único cambio de esquema
   autorizado para esta feature.)_

2. **Cantidad de periodos configurable por grupo: 2 o 3.**
   Cubre el MEP clásico (3 trimestres) y el reciente (2 semestres). Se elige al
   crear/editar el grupo.

3. **Rubros por periodo.** Cada periodo define sus propios rubros de evaluación
   (categorías con porcentaje que suman 100% *dentro de cada periodo*).

4. **Pre-llenado inteligente de rubros.** Al definir los rubros del **I Periodo**,
   estos aparecen pre-cargados en los demás periodos como **borrador editable**.
   No se guardan hasta que el docente confirme/cree cada periodo.

5. **"Rúbricas" = rubros de evaluación.** En este contexto, "poner rúbricas por
   periodo" se refiere a las categorías con porcentaje (Tareas, Exámenes…), no a
   la rúbrica de criterios de cada asignación (esa sigue igual, por asignación).

### Cambio de esquema (correr en el SQL editor de Supabase)

```sql
alter table public.asignaciones
  add column periodo text not null default 'I'
  check (periodo in ('I','II','III'));
```

Aditivo y reversible. Las asignaciones existentes quedan en `'I'`.

### Convenciones de datos (sin tocar esquema)

- **`grupos.periodo`** (texto ya existente) se **reutiliza** para guardar la
  *cantidad* de periodos del grupo: `"2"` o `"3"`. El significado anterior
  ("I Periodo") queda obsoleto porque el grupo ahora abarca todo el año.
- **`grupos.rubros`** (jsonb) pasa de arreglo plano `[{nombre,porcentaje}]` a
  estar **agrupado por periodo**:
  ```json
  { "I": [{"nombre":"Tareas","porcentaje":40}],
    "II": [ ... ],
    "III": [ ... ] }
  ```
  Cada periodo suma 100% por separado. El código debe leer **también** el
  formato viejo (arreglo plano = rubros del I Periodo) para no romper grupos ya
  creados.

### Impacto en el frontend

| Archivo | Cambio |
|---|---|
| `lib/periodos.js` *(nuevo)* | Constantes: orden `['I','II','III']`, etiquetas, helpers. |
| `services/grupos.service.js` | Leer/normalizar rubros por periodo + cantidad de periodos; `guardarRubros(periodo, …)`. |
| `services/asignaciones.service.js` | Incluir `periodo` en crear/editar/limpiar; `listarAsignaciones(grupoId, periodo)` filtra. |
| `components/docente/GrupoForm.jsx` | Reemplazar el dropdown "Periodo" por **"Cantidad de periodos" (2/3)**. |
| `components/docente/RubrosEditor.jsx` | Selector I/II/III; pre-llena los demás desde el I como borrador editable; se guarda por periodo. |
| `components/docente/AsignacionForm.jsx` | Selector **Periodo**; las opciones de rubro salen de los rubros de ese periodo. |
| `pages/docente/GrupoDetalle.jsx` | Selector global **Periodo** que filtra Asignaciones (y luego Notas). |
| `components/docente/AsignacionesPanel.jsx` | Filtrar por periodo activo; etiquetar nuevas asignaciones con él. |

### Pendiente / a revisar

- Selector de periodo "activo" en la interfaz: es estado de UI (no se persiste
  en la base; se puede guardar en la URL o `localStorage`).
- Notas (paso 8): el promedio del periodo **renormaliza** entre los rubros ya
  calificados (no castiga lo que aún no se evalúa). Si se prefiere contar lo no
  calificado como 0, cambiar `calcularNotasPeriodo` en `lib/notas.js`.

---

## ADR-002 — Almacenamiento de archivos en Cloudflare R2

**Estado:** Acordado · 2026-06-13

### Decisión

Los archivos de entregas y de clases se guardan en **Cloudflare R2** (no en
Cloudinary, como decía el plan original). Motivo: el plan gratuito de R2 da
10 GB y **ancho de banda de salida gratis e ilimitado**, que es el recurso que
suele agotarse en otros servicios. Además queda en la misma casa que el hosting
(Cloudflare Pages).

### Cómo funciona

R2 no permite subida anónima directa (a diferencia del preset unsigned de
Cloudinary). El flujo usa **URLs pre-firmadas**:

```
Estudiante/Docente logueado
  → pide URL firmada a la Edge Function `firmar-subida` (verifica la sesión)
  → sube el archivo DIRECTO a R2 con esa URL (no pasa por ningún proxy)
  → guarda la URL pública en la base (entrega_archivos / clase_archivos)
```

Las credenciales de R2 viven **solo** en los secrets de la Edge Function, nunca
en el frontend. Las imágenes se comprimen en el cliente (≤1600px) antes de subir.

### Componentes

- `supabase/functions/firmar-subida/index.ts` — firma la URL PUT (usa
  `aws4fetch`). Secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE`.
- `frontend/src/services/storage.service.js` — única capa que toca el
  almacenamiento (compresión + pedir firma + PUT). Para cambiar de proveedor en
  el futuro, solo se toca este archivo.

### Setup requerido (una vez, en la cuenta del docente)

1. Crear bucket R2 (ej. `puranota-entregas`).
2. Activar acceso público del bucket (dominio `r2.dev`) → `R2_PUBLIC_BASE`.
3. Crear API Token R2 (Object Read & Write) → access key id + secret + account id.
4. Configurar **CORS** del bucket para permitir `PUT` desde el origen del sitio
   (localhost en dev y el dominio de Pages en prod).
5. Guardar los 5 secrets en Supabase y desplegar: `supabase functions deploy firmar-subida`.

### Limpieza de objetos en R2 (resuelto 2026-06-14)

Antes, al borrar una entrega/clase se borraba la fila pero el objeto quedaba
huérfano en R2. Ahora hay una Edge Function **`borrar-archivo`** que elimina el
objeto físico:

- **Seguridad:** solo borra objetos cuya key empieza con `entregas/{user.id}/`,
  o sea, archivos subidos por el propio usuario autenticado (nadie borra ajenos).
- `services/storage.service.js` → `borrarArchivos(urls)` (best-effort: si falla,
  no interrumpe la acción; la base es la fuente de verdad).
- Se llama desde `eliminarClase` y `eliminarArchivoClase` (clases) y
  `eliminarArchivo` (entregas) — recolectando las URLs **antes** del borrado en
  cascada.
- Deploy: `supabase functions deploy borrar-archivo` (usa los secrets de R2 ya
  configurados; el token de R2 debe permitir borrado).

**Limitación conocida:** cuando el docente borra una **asignación**, la cascada
elimina las entregas y sus archivos (subidos por estudiantes, prefijo distinto),
que el docente no puede borrar por la regla de seguridad → esos quedan huérfanos.
El caso grande (videos de clase, subidos por el docente) sí se limpia.

---

## ADR-003 — Sistema de contraseñas (sin correo)

**Estado:** Acordado · 2026-06-14

### Decisión

Los estudiantes **no recuperan la contraseña por correo** (el servicio de correo
gratuito de Supabase es poco confiable). En su lugar, tres piezas:

1. **Cambiar contraseña (logueado):** en `/cuenta`, el usuario ingresa la actual
   (se verifica re-autenticando) y la nueva.
2. **Recuperar con pregunta de seguridad:** en el onboarding el usuario elige una
   **pregunta fija** (lista en `lib/preguntas-seguridad.js`) y guarda su respuesta.
   En login → "Olvidé mi contraseña": correo → se muestra su pregunta → responde →
   si coincide, fija una nueva clave y entra.
3. **Reset por el docente (respaldo):** desde la lista de estudiantes, genera una
   contraseña temporal y la muestra para dictársela al estudiante.

Tras un reset del docente, el flag **`debe_cambiar_clave`** obliga al estudiante a
crear una nueva clave en `/cambiar-clave` antes de usar la app.

### Seguridad

- La **respuesta de seguridad nunca se guarda en texto plano**: se normaliza
  (minúsculas + trim) y se hashea con **PBKDF2-SHA256 + salt** dentro de la Edge
  Function (única fuente de verdad del hashing). Formato: `pbkdf2$iter$salt$hash`.
- Cambiar la clave de un usuario **sin sesión** (recuperación) o **de otro usuario**
  (reset docente) requiere `service_role` → se hace en Edge Functions, nunca en el
  frontend. La `service_role` está auto-inyectada (`SUPABASE_SERVICE_ROLE_KEY`), no
  hay secrets nuevos.
- El docente **nunca ve contraseñas** (son hash irreversible), solo resetea.

### Cambio de esquema (correr en el SQL editor)

```sql
alter table public.perfiles
  add column pregunta_seguridad text,
  add column respuesta_hash text,
  add column debe_cambiar_clave boolean not null default false;
```

### Edge Functions

- `supabase/functions/recuperar-clave/index.ts` — acciones `definir` (con sesión),
  `pregunta` y `restablecer` (anónimas). **Desplegar con `--no-verify-jwt`**
  (las acciones de recuperación no llevan sesión):
  `supabase functions deploy recuperar-clave --no-verify-jwt`
- `supabase/functions/resetear-clave-estudiante/index.ts` — valida que quien llama
  es docente dueño del grupo del estudiante; genera temporal; `admin.updateUserById`;
  marca `debe_cambiar_clave`. Deploy normal:
  `supabase functions deploy resetear-clave-estudiante`

### Impacto en el frontend

| Archivo | Cambio |
|---|---|
| `lib/preguntas-seguridad.js` *(nuevo)* | Lista fija de preguntas de seguridad. |
| `components/CampoContrasena.jsx` *(nuevo)* | Input de contraseña con botón ver/ocultar. |
| `pages/MiCuenta.jsx` *(nuevo)* | Cambiar clave + editar pregunta de seguridad. |
| `pages/CambiarClaveObligatorio.jsx` *(nuevo)* | Cambio forzado tras reset. |
| `pages/OlvideContrasena.jsx` | Menú de 3 opciones de recuperación (ver actualización abajo). |
| `pages/Onboarding.jsx` | Define pregunta + respuesta de seguridad. |
| `services/auth.service.js` | `cambiarContrasena`, `definirPregunta`, `obtenerPregunta`, `recuperarConRespuesta`. |
| `services/perfil.service.js` | `resetearClaveEstudiante`, `limpiarDebeCambiarClave`. |
| `context/AuthContext.jsx` | Expone `debeCambiarClave`. |
| `components/ProtectedRoute.jsx`, `App.jsx` | Guard de cambio forzado; rutas `/cuenta` y `/cambiar-clave`. |
| `components/docente/EstudiantesPanel.jsx` | Botón "Resetear clave" + modal con la temporal. |

### Actualización (2026-06-14): recuperación por correo reintroducida

La pantalla "Olvidé mi contraseña" se rehízo como **menú de 3 opciones**:
(1) **pregunta de seguridad**, (2) **correo de recuperación** (flujo nativo de
Supabase: `resetPasswordForEmail` con `redirectTo` a la ruta `/restablecer`),
(3) **pedir ayuda al docente**. El SMTP integrado de Supabase es lento (se
recomienda SMTP propio para producción), pero el correo vuelve a ser una opción
real junto a la pregunta de seguridad.

- Nuevos: `pages/Restablecer.jsx` (atrapa el token del hash/query y maneja
  `PASSWORD_RECOVERY`), `recuperarPorCorreo` y `alRecuperarClave` en
  `auth.service.js`.
- La ruta `/restablecer` va **fuera de `SoloInvitados`** (el token crea una sesión
  temporal de recovery que, si no, expulsaría al usuario antes de mostrar el
  formulario → causaba "página en blanco").
- Config en Supabase → Auth → URL Configuration: Site URL `http://localhost:5173`
  y Redirect URLs `http://localhost:5173/restablecer` (+ los de producción).

---

## ADR-004 — Visibilidad de archivos de entrega tras calificar (RLS)

**Estado:** Acordado · 2026-06-14

La política RLS original de `entrega_archivos` dejaba al **estudiante** leer sus
archivos **solo mientras la entrega estaba `entregada`**. Al calificar
(`calificada`) se le ocultaban → el estudiante ya no veía lo que entregó. Se agrega
una política **aditiva de solo lectura** (se combinan con OR; la política vieja
sigue controlando insertar/borrar, así solo puede **ver** siempre pero **modificar**
solo antes de calificar):

```sql
create policy "estudiante ve sus archivos" on public.entrega_archivos
  for select using (
    exists (
      select 1 from public.entregas e
      where e.id = entrega_id and e.estudiante_id = auth.uid()
    )
  );
```

---

## ADR-005 — Video propio en clases (subido a R2)

**Estado:** Acordado · 2026-06-14

### Decisión

Además del video de YouTube embebido, una clase puede tener un **video propio**
del docente (sus grabaciones), subido a R2 y reproducido con un reproductor
`<video>` nativo dentro de la app. Para videos largos se sigue recomendando
YouTube (streaming adaptativo, no consume el almacenamiento de R2).

### Cómo funciona

- El video se sube por la misma tubería de URL firmada que el resto de archivos
  (ADR-002) y se guarda como una fila de **`clase_archivos`** con `tipo` `video/*`
  (sin columnas nuevas en la base).
- `ClaseContenido` separa los archivos de tipo `video/*` (los reproduce con
  `<video controls playsInline>`) del resto (fotos/PDF → galería).
- Límite **200 MB** por video; tipos `video/mp4` (recomendado), `video/webm`,
  `video/quicktime`. La subida muestra **barra de progreso** (vía `XMLHttpRequest`).

### Cambios

- `supabase/functions/firmar-subida/index.ts`: agrega los MIME de video y un tope
  de 200 MB para video (imágenes/PDF siguen en 10 MB). **Requiere redeploy:**
  `supabase functions deploy firmar-subida`.
- `services/storage.service.js`: `subirVideo(file, onProgress)`, `ACCEPT_VIDEO`,
  subida con `XMLHttpRequest` para reportar progreso (`onProgress`).
- `components/docente/ClaseForm.jsx`: opción "subí tu propio video" + barra de
  progreso; en edición, el video actual se gestiona aparte (no se duplica).
- `components/docente/ClasesPanel.jsx`: sube el video al guardar; etiqueta 🎬.
- `components/ClaseContenido.jsx`: reproductor de video nativo.

### Pendiente / a revisar

- Igual que ADR-002: el objeto en R2 no se borra al eliminar la clase (huérfano).
- Sin transcodificación: se reproduce tal cual se sube (MP4/H.264 es lo más
  universal entre navegadores y celulares).

---

## ADR-006 — Asistencia que cuenta para la nota (configurable, por periodo)

**Estado:** Acordado · 2026-06-14

### Decisión

La asistencia puede **afectar la nota** como un **rubro más**, calculado solo (no
se escribe a mano), **configurable por el docente** y **por periodo**.

- En el editor de rubros, el docente marca "Incluir asistencia como rubro", le
  pone su **%** (cuenta dentro del 100% del periodo) y la **regla**:
  - **Tardías por ausencia** (ej. 2 → "2 tardías = 1 ausencia").
  - **¿La justificada cuenta como asistencia?** (sí/no).
- La nota del rubro (0-100) =
  `(registrados − ausencias) / registrados × 100`, con
  `ausencias = ausentes + tardías/tardiasPorAusencia (+ justificadas si no cuentan)`.
- Se calcula **por periodo** usando el **rango de fechas** de cada periodo
  (nuevo `grupos.periodos_fechas`). Si un periodo no tiene fechas, cae a "todo el año".

### Almacenamiento

- El rubro de asistencia vive en `grupos.rubros` (jsonb) como una entrada normal
  con campos extra: `{nombre:'Asistencia', porcentaje, asistencia:true,
  tardiasPorAusencia, justificadaCuenta}` → **sin columnas nuevas para esto**.
- Las **fechas de periodo** sí necesitan una columna nueva (jsonb):

```sql
alter table public.grupos
  add column periodos_fechas jsonb not null default '{}'::jsonb;
```

Aditivo. Formato: `{ "I": {"inicio":"YYYY-MM-DD","fin":"YYYY-MM-DD"}, "II": {…} }`.

### Impacto en el frontend

| Archivo | Cambio |
|---|---|
| `lib/notas.js` | `notaAsistencia(conteos, regla)`, `contarAsistencia(rows, rango)`; `calcularNotasPeriodo` acepta los conteos y calcula el rubro de asistencia. |
| `services/grupos.service.js` | `periodosFechas(grupo)`, `guardarPeriodosFechas`. |
| `components/docente/RubrosEditor.jsx` | Sección "Incluir asistencia como rubro" (% + regla); la suma del periodo incluye la asistencia. |
| `components/docente/PeriodosFechas.jsx` *(nuevo)* | Fechas inicio/fin por periodo (sección plegable en la pestaña **Asistencia**). |
| `components/docente/NotasPanel.jsx`, `components/estudiante/NotasEstudiante.jsx` | Cuentan la asistencia por rango de periodo y la pasan al cálculo. |

### Pendiente / a revisar

- La asistencia se cuenta por **fecha dentro del rango del periodo**; si las fechas
  se solapan o faltan, cae a "todo el año".
- Sigue mostrándose además un % de asistencia "crudo" como referencia (solo las
  ausencias lo bajan), separado de la nota del rubro (que aplica la regla).

---

## Cambios de esquema aplicados (resumen)

Todos corridos a mano en el SQL editor (la base es de producción). En orden:

1. `asignaciones.periodo` (ADR-001).
2. `perfiles`: `pregunta_seguridad`, `respuesta_hash`, `debe_cambiar_clave` (ADR-003).
3. Política `estudiante ve sus archivos` en `entrega_archivos` (ADR-004).
4. `grupos.periodos_fechas` jsonb (ADR-006) — **pendiente de correr** al momento de escribir esto.

Edge Functions desplegadas: `firmar-subida` (re-desplegada con soporte de video,
ADR-005), `recuperar-clave` (con `--no-verify-jwt`), `resetear-clave-estudiante`,
`borrar-archivo` (limpieza de R2 — requiere `supabase functions deploy borrar-archivo`).

---

## Mejoras de UI/UX (2026-06-14)

No son decisiones de arquitectura, pero quedan registradas:

- **Pestañas responsivas** (`components/Tabs.jsx`): se deslizan en horizontal en
  móvil sin amontonarse (grupo del docente y del estudiante).
- **Tablas → tarjetas en móvil**: Notas y resumen de Asistencia se muestran como
  tarjetas en celular y como tabla en escritorio.
- **Botones de acción táctiles** (`.btn-accion` en `index.css`): tamaño y separación
  adecuados para el dedo, consistentes en toda la app.
- **Pulido**: encabezado con acceso a "Mi cuenta" (ícono), estados vacíos con ícono
  (`components/EstadoVacio.jsx`), skeletons de carga (`components/SkeletonLista.jsx`).
- **Código de acceso compacto**: pasó de un bloque grande a una barra normal.
- **Ver/ocultar contraseña** en todos los campos (`components/CampoContrasena.jsx`).

## Rediseño de UI/UX responsive (2026-06-14, segunda iteración)

Actualiza varios puntos de la sección anterior:

- **3 anchos de contenedor** (`Layout` con prop `ancho`): `normal` (1440px,
  dashboards con rejillas), `amplio` (1400px, detalle de grupo con barra lateral),
  `estrecho` (max-w-4xl, vistas de lectura/edición en una columna).
- **Navegación del grupo** (docente *y* estudiante): **barra lateral fija** en
  escritorio, **pastillas** que envuelven en móvil (todas visibles, sin scroll
  horizontal). `Tabs` soporta `orientacion` `horizontal` / `vertical` / `wrap`.
- **Componente `Volver`** (`components/Volver.jsx`): botón sutil con flecha que se
  desliza en hover; reemplaza los enlaces de texto "← …" de toda la app.
- **Botones** (`index.css`): sombra sutil, micro-interacción `active:scale`, foco
  accesible con ring; secundario con fondo blanco.
- **Regla de distribución:** rejillas y tablas a ancho completo; formularios,
  códigos y listas de una columna acotados/centrados. Código de acceso como
  tarjeta compacta; Asignaciones/Clases en rejilla de 2 columnas.
