# Ambiente de pruebas (staging)

Decisión **D9** del [plan](./PLAN.md): un segundo proyecto de Supabase, gratis,
con **datos falsos**, para poder probar sin miedo. Antes de esto, `localhost` y
el sitio publicado escribían **en la misma base de producción**: cualquier
prueba tocaba datos reales.

---

## 1. Cómo se usa

```powershell
cd C:\puranota\frontend
npm run dev:staging      # http://localhost:5173 contra la base de PRUEBAS
npm run dev              # http://localhost:5173 contra la base REAL
```

La cabecera muestra en qué ambiente estás (`components/Ambiente.jsx`): pastilla
**ámbar** cuando es la base de pruebas, **roja** cuando es la real. Solo aparece
en local; el sitio publicado va limpio.

> Si `npm run dev:staging` falla porque no existe `frontend/.env.staging`, es
> porque `.gitignore` no versiona ningún `.env`. Se recrea con el punto 4.

---

## 2. Con qué usuario entrar

**La contraseña de todos es `Prueba2026!`**

| Rol | Correo | Qué tiene |
|---|---|---|
| Docente | `docente1@prueba.test` | 7-1 Matemática · **3 periodos** · 28 estudiantes |
| Docente | `docente2@prueba.test` | 10-2 Estudios Sociales · aprueba matrícula a mano · tiene un **foro** |
| Docente | `docente3@prueba.test` | 3-5 Diseño de Software · modalidad **dual** · portafolio de evidencias |
| Docente | `docente4@prueba.test` | 9-3 Ciencias · acá está el caso de la penalización fantasma |
| Estudiante | `est001@prueba.test` … `est090@prueba.test` | matriculados en uno o dos grupos |

`est001` está en dos grupos a la vez (7-1 y 9-3), que es el caso realista.

---

## 3. Qué hay sembrado, y por qué eso

No son datos al azar: cada cosa existe para poder mirar un estado distinto de la
interfaz.

| | |
|---|---|
| **94 usuarios** | 4 docentes y 90 estudiantes, con nombre, teléfono y sección |
| **4 grupos** | uno de 3 periodos y tres de 2; cuatro modalidades del MEP distintas |
| **98 matrículas** | incluidas **3 solicitudes pendientes** en el 10-2, y 3 prematrículas sin usar |
| **16 clases** | con markdown, videos de YouTube, material adjunto y **una sin publicar** |
| **43 actividades** | los cuatro tipos: entrega, prueba, proyecto y **foro** |
| **735 entregas** | 659 calificadas, **76 sin revisar** (pastilla «No revisado»), 74 tardías |
| **~5.000 asistencias** | dos lecciones por semana desde el 1 de febrero |
| **5 avisos** | de distintos docentes a sus grupos |

Estados que quedaron cubiertos a propósito:

- Un **periodo cerrado** (todo calificado) y otro **en curso** (mezcla de
  calificado, entregado sin revisar, sin entregar y todavía sin vencer).
- Actividades **futuras**, algunas con entregas adelantadas.
- Una actividad **oculta** (`visible = false`) en el III Periodo del 7-1.
- Estudiantes con asistencia mala, para ver los tramos de la escala del Art. 37
  (no todos en el 100).
- **El caso de la penalización fantasma** (`CLAUDE.md` §7.6 A): en el 9-3 las
  pruebas escritas quedaron marcadas `tardia = true` por el trigger *y* con 10%
  de penalización. La nota **no** debe bajar. Ver punto 5.

---

## 4. Cómo se recrea desde cero

1. Crear un proyecto nuevo en Supabase (plan gratuito, US$0).
2. Correr **`backend/esquema.sql`** completo en el SQL Editor. Ese archivo es un
   espejo fiel de producción, generado desde el catálogo de Postgres.
3. Correr el sembrado (los bloques SQL quedaron en el historial de la
   conversación; lo que importa está descrito en el punto 3).
4. Crear `frontend/.env.staging`:

```
VITE_SUPABASE_URL=https://<ref-del-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<la clave publicable>
VITE_AMBIENTE=staging
```

> **Detalle que cuesta una hora si no se sabe:** si los usuarios se insertan a
> mano en `auth.users`, el login devuelve `500 Database error querying schema`.
> Es porque GoTrue no tolera `NULL` en sus columnas de token. Hay que dejarlas
> en cadena vacía:
> ```sql
> update auth.users set
>   confirmation_token = coalesce(confirmation_token,''),
>   recovery_token = coalesce(recovery_token,''),
>   email_change_token_new = coalesce(email_change_token_new,''),
>   email_change = coalesce(email_change,''),
>   email_change_token_current = coalesce(email_change_token_current,''),
>   phone_change = coalesce(phone_change,''),
>   phone_change_token = coalesce(phone_change_token,''),
>   reauthentication_token = coalesce(reauthentication_token,'');
> ```

---

## 5. Lo que ya se verificó con estos datos

El esquema de staging se comparó contra producción: **13 tablas, 110 columnas,
29 políticas, 9 funciones, 4 triggers y 43 restricciones** en ambos lados.

Y el cálculo de notas se comprobó **por dos caminos independientes**: se corrió
el módulo real (`lib/notas.js`) sobre los datos sembrados y se recalculó lo
mismo en SQL puro. Coinciden al centavo:

| Estudiante (7-1, I Periodo) | `lib/notas.js` | SQL |
|---|---|---|
| Adriana Villalobos Gutiérrez | 71,35 | 71,35 |
| Ana Rojas Rojas | 65,09 | 65,09 |
| Andrés Ramírez Alfaro | 62,67 | 62,67 |

Y el caso de la penalización fantasma, en el 9-3:

| Estudiante | Nota que da la app | Nota si volviera el error | Se perdían |
|---|---|---|---|
| Adriana Villalobos Gutiérrez | 64,79 | 62,70 | 2,09 |
| Ana Rojas Rojas | 69,97 | 67,23 | 2,74 |
| Andrés Ramírez Alfaro | 36,45 | 35,02 | 1,43 |

---

## 6. Reglas

- **Nunca se prueba masivamente contra producción.** Para eso existe esto.
- Los archivos adjuntos son URLs falsas (`ejemplo-staging.invalid`): se sembraron
  como PDF a propósito, porque la galería los muestra como ficha con su nombre y
  no intenta cargar una miniatura que no existe. **Subir archivos de verdad no
  funciona en staging** (no hay bucket de R2 aparte); eso se prueba en local o en
  el sitio publicado.
- Los correos `@prueba.test` no existen: la recuperación por correo no llega.
  Para probar eso está la pregunta de seguridad o el reseteo por el docente.
- Este proyecto **también se pausa** si queda inactivo 7 días (plan gratuito).
  No se le puso keep-alive a propósito: si se pausa, se reactiva desde el panel
  y no se pierde nada, porque son datos falsos.
