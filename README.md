# PuraNota ✓

**Plataforma web para docentes del MEP de Costa Rica.** Los estudiantes entregan
cotidianos y tareas desde el celular, el docente revisa, califica, pasa asistencia
y publica clases con video. Las notas se calculan solas siguiendo el reglamento
oficial de evaluación (REAC 2026).

> **Estado:** Fase 1 completa y en uso de prueba. El módulo de notas se rehízo el
> 25 de julio de 2026 como registro académico formal. Ver [`docs/PLAN.md`](docs/PLAN.md).

---

## Qué hace

**El docente**
- Crea grupos y comparte un código de 6 caracteres para que los estudiantes entren.
- Define los rubros de evaluación por periodo (Trabajo cotidiano, Tareas, Pruebas…),
  con presets oficiales del MEP según la modalidad.
- Crea actividades con fecha límite, valor porcentual, rúbrica y material adjunto.
- Revisa las entregas (fotos y PDF) y califica con observaciones.
- Pasa asistencia, que puede contar para la nota como un rubro automático.
- Publica clases con contenido, video de YouTube o video propio, y adjuntos.
- Ve el registro de calificaciones completo del grupo.

**El estudiante** (casi siempre desde el celular)
- Se une con el código y ve sus clases y actividades.
- Sube su entrega y la puede reemplazar antes de la fecha límite.
- Ve su registro de evaluación: qué vale cada actividad, qué sacó, y su nota final.

**El norte del producto:** que sea tan fácil que "hasta un chiquito" lo use.
Ante la duda entre *simple* y *configurable*, gana simple.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + JavaScript + Tailwind CSS + react-router-dom |
| Backend | Supabase — Auth, Postgres con RLS, Edge Functions (Deno) |
| Archivos | Cloudflare R2, subida directa con URL pre-firmada |
| Hosting | Cloudflare Pages |

Todo corre dentro de los planes gratuitos de esos servicios.

---

## Cómo correrlo

Necesitás Node 18 o superior.

```bash
cd frontend
npm install
cp .env.example .env      # y completá las dos variables
npm run dev               # http://localhost:5173
```

```
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<la anon key, que es pública>
```

Otros comandos:

```bash
npm run build     # build estático para Cloudflare Pages
npm run preview   # sirve el build local
```

Edge Functions (requieren la CLI de Supabase):

```bash
supabase functions deploy firmar-subida
supabase functions deploy recuperar-clave --no-verify-jwt
```

---

## Estructura

```
CLAUDE.md              Documento maestro: cómo funciona todo el sistema hoy
docs/
  PLAN.md              Plan de trabajo y decisiones cerradas (a dónde va)
  ADR.md               Historial de decisiones de arquitectura
  keep-alive.md        Cómo evitar que Supabase pause el proyecto
  mep/                 Reglamento REAC 2026 (fuente de las reglas de evaluación)
imagenes/              Referencia visual de diseño
backend/               SQL original de Fase 1
supabase/functions/    Edge Functions
scripts/               Utilidades locales
frontend/src/
  lib/                 Lógica pura sin red (notas, MEP, periodos, formato)
  services/            ÚNICA capa que habla con Supabase
  context/             Sesión y perfil
  components/          UI compartida + docente/ + estudiante/
  pages/               Rutas
```

**Regla de arquitectura:** ningún componente importa el cliente de Supabase.
Toda llamada pasa por `src/services/`. Es lo que permite cambiar de backend
tocando una sola carpeta.

---

## Documentación

| Archivo | Para qué |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | **Empezá acá.** El sistema completo: esquema real de la base, cálculo de notas, RLS, Edge Functions, cómo probar cada módulo. |
| [`docs/PLAN.md`](docs/PLAN.md) | Las decisiones cerradas y el orden de trabajo. Lo que viene. |
| [`docs/ADR.md`](docs/ADR.md) | Por qué se llegó a las decisiones actuales. |
| [`docs/keep-alive.md`](docs/keep-alive.md) | Que el proyecto de Supabase no se pause. |

---

## Cómo se calculan las notas

Tres palabras, las mismas en el código y en las dos pantallas:

- **Valor %** — cuánto vale la actividad dentro del periodo.
- **Calificación** — `(nota ÷ puntos) × Valor %`, expresada **en porcentaje**.
- **NOTA FINAL** — la **suma** de la columna Calificación.

Si una actividad vale 15% y el estudiante sacó 8 de 10, su calificación es
`12,00%`. La nota final es una suma que el docente puede verificar de cabeza.

Dos decimales en las notas de periodo, redondeo solo en el promedio anual
(REAC 2026, Art. 26). Todo el cálculo vive en un archivo:
[`frontend/src/lib/notas.js`](frontend/src/lib/notas.js).

---

## Privacidad

El sistema maneja **datos personales de menores de edad**: nombres, correos,
teléfonos, notas y asistencia. Este repositorio es **público**, así que la regla
es simple y no se rompe:

> **Acá vive el código. Ningún dato de estudiante entra a este repositorio, ni
> siquiera cifrado.**

- Los **respaldos** (volcados de la base y planillas de notas) se guardan
  cifrados en un repositorio **privado aparte**. Ver [`docs/PLAN.md`](docs/PLAN.md) §5.
- La `service_role` key de Supabase **nunca** va en el frontend: todo lo que la
  necesita vive en una Edge Function, con los secretos del lado del servidor.
- Los archivos `.env` no se versionan; en la documentación van marcadores en
  lugar de identificadores reales del proyecto.
- Las credenciales de Cloudflare R2 viven solo como secretos de Edge Function.
- La `anon key` de Supabase sí es pública por diseño: la protección real son las
  políticas RLS de la base, no esconder la llave.

---

## Convenciones

- Todo el texto de la interfaz en **español de Costa Rica**, tono cercano.
- Commits en español, pequeños y descriptivos.
- Mobile-first literal: una vista no está terminada hasta verse bien en 390 px.
- Nada de `bg-white` ni colores fijos — solo los tokens del tema, o se rompe el
  modo oscuro.
- Cambios de esquema: siempre aditivos, corridos a mano y anotados en
  `CLAUDE.md` §6.5.

---

© Jefernee Ruiz. Todos los derechos reservados.
