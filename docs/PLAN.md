# PuraNota — Plan de trabajo y visión

> **Para qué existe este documento:** para dejar de cambiar de idea.
> Acá están las decisiones **cerradas**, en orden de prioridad, con el porqué de
> cada una. Vos das el visto bueno **una vez** (§13) y de ahí en adelante nadie
> —ni vos ni yo— reabre una decisión sin escribir acá por qué cambió.
>
> Complementa a [`CLAUDE.md`](../CLAUDE.md), que describe el sistema **como está
> hoy**. Este documento describe **a dónde va**.
>
> v3 · 2026-07-25 · incluye el estado real de lo ya construido.

---

## 1. Diagnóstico honesto: por qué te has estado atrasando

No es que trabajés lento. Son cuatro causas concretas y todas tienen arreglo:

1. **El módulo de notas nunca tuvo un modelo de referencia.** Se diseñó "desde
   cero" en vez de copiar cómo se ve un registro académico de verdad. Por eso
   cada versión se sentía rara y pedías otro cambio: el cambio arreglaba una
   vista y rompía la otra. **Ya hay referencia** (§3.0) y con eso se acabó la
   discusión.
2. **No hay red de seguridad.** Sin git, sin pruebas y sin respaldos, cada cambio
   es una apuesta. Por eso da miedo tocar notas.
3. **No hay ambiente de prueba con datos.** Con 1 grupo y 2 asignaciones no se ve
   si el registro aguanta 30 estudiantes y 40 actividades. Estás diseñando a ciegas.
4. **El proyecto vive en una sola computadora.** Sin repositorio remoto, un disco
   dañado = se perdió todo. Esto es más urgente que cualquier función.

**Traducción:** las primeras horas de trabajo no son funciones nuevas, son **piso
firme**. Sin eso, todo lo demás se sigue atrasando.

---

## 2. Decisiones cerradas

| # | Decisión | Por qué |
|---|---|---|
| **D1** ✅ | **La calificación se expresa en porcentaje, no en puntos.** Si la actividad vale 35% y le fue bien, la celda dice `31,50%`. La nota final es la **suma de esa columna**. | Es como se hace en papel y como lo hace la UISIL. Todo lo demás fue pelear contra tu modelo mental. |
| **D2** ✅ | **Un solo número final: `NOTA FINAL: 90/100%`.** Sin "acumulada" ni "proyectada". Al lado, en letra chica, cuánto del periodo se lleva evaluado. | *(Corregido tras ver la UISIL.)* Los sistemas académicos muestran una sola cifra. Los dos números eran invención mía. |
| **D3** ✅ | **La vista del estudiante es una tabla de registro**, no tarjetas: `Tipo · Actividad · Fecha/Hora · Estado · Valor % · Calificación`. | *(Corregido.)* Las barras de progreso y las tarjetas grandes no son lenguaje académico. |
| **D4** ✅ | Decimales según **REAC Art. 26**: periodo con **2 decimales**; promedio anual redondeado (≥0,50 sube). | Regla oficial. Hoy la app usa 1 decimal y a veces 0, y no coincide con el registro del MEP. |
| **D5** ✅ | La actividad se une al rubro por **`rubro_id` estable**, no por nombre de texto. | Deuda técnica #1 de notas. Hoy migrar toma 20 min (hay 2 asignaciones); en marzo, un fin de semana. |
| **D6** ✅ | **Módulo admin vía Edge Function con `service_role`**, no políticas RLS de admin en 13 tablas. | Menos superficie de error; el poder de admin queda en un archivo auditable. |
| **D7** ✅ | **Respaldos: git + remoto privado, volcado semanal automático y export a Excel en la app.** No se paga Supabase Pro. | Tres capas independientes. El export además es una función que el docente quiere igual. |
| **D8** ✅ | **Testing: Vitest + Playwright** como `devDependencies`. | Excepción justificada a "no instalar librerías": no viajan al navegador y son lo único que evita que notas se vuelva a romper. |
| **D9** ✅ | **Staging = segundo proyecto Supabase gratis** con datos falsos. Nunca se prueba masivamente contra producción. | Gratis, y elimina el miedo a probar. |
| **D10** ✅ | El grupo del estudiante pasa a **4 pestañas formales**: Clases · Evaluación · Recursos · Ausencias/Tardías (§8). | Estructura de la UISIL. Hoy hay 3 pestañas y se siente vacío porque la app tiene datos que no muestra. |
| **D11** ✅ | **Indexación: landing pública estática + app con `noindex`.** | Google no puede indexar lo que está detrás de un login. |
| **D12** ✅ | **Móvil primero, literal:** ninguna vista se termina hasta verse bien en **390 px**. | Los estudiantes usan celular. Hoy se diseña grande y se parcha. |
| **D13** ✅ | **`asignaciones.tipo`** (`entrega · prueba · proyecto · foro`) se agrega **hoy**, aunque los foros se construyan en el bloque 2. | La tabla de Evaluación ya necesita la columna Tipo. Agregarla ahora cuesta 5 minutos; derivarla a mano y rehacerla después cuesta un día. Es el enchufe donde se conecta el foro (§8.1). |
| **D14** ✅ | **Los respaldos corren en la nube, no en tu PC**: un GitHub Action semanal genera el volcado de la base y los CSV de notas, los **cifra** y los guarda en un **repositorio privado aparte** (`puranota-respaldos`). Se borran solos a los 6 meses. | Pediste no depender de acordarte. Una tarea en tu computadora depende de que esté encendida; esta no depende de nada tuyo. |
| **D16** ✅ | **Dos repositorios: `puranota` público (código, portafolio) y `puranota-respaldos` privado (datos).** El código nunca guarda datos. | *(2026-07-25.)* Querés mostrarlo a empleadores, y eso es bueno. Pero un repositorio público con datos de menores no es una opción, ni cifrados. Separarlos además es mejor arquitectura: los respaldos nunca pertenecen al repositorio de código. |
| **D15** ✅ | **Desplegar temprano (bloque 1) con `noindex`; indexar al final (bloque 2).** | Publicar temprano te da una dirección real para probar en el celular y el flujo "subo un cambio y se publica solo". Indexar temprano solo lograría que Google vea un producto a medias. |

---

## 3. El módulo de notas, resuelto

### 3.0 Referencia visual: Aula Virtual de la UISIL

Las capturas están en **`imagenes/`** y son la referencia de estructura.
La regla, en una línea:

> **Estructura y formalidad de la UISIL + identidad visual de PuraNota.**

De la UISIL se copia **cómo se organiza y se nombra la información**: la tabla de
registro, sus columnas, las pestañas del curso, la densidad. De PuraNota se
conserva **cómo se ve**: paleta, tipografía, tema oscuro, bordes suaves. No se
copian los banners con foto de fondo ni los íconos de colores saturados.

**Descartado de mis propuestas anteriores:** barras de progreso, tarjetas grandes
por rubro, y el vocabulario "aporte / acumulada / proyectada". Ningún sistema
académico habla así.

### 3.1 Vocabulario (el de un registro, no el mío)

Tres palabras, las mismas en el código y en las dos pantallas. Son las que ya usa
la UISIL, así que a un docente no hay que explicárselas.

| Palabra | Qué es | Unidad | Ejemplo |
|---|---|---|---|
| **Valor %** | Cuánto vale la actividad dentro del periodo | `%` | Un examen que vale **35%** |
| **Calificación** | Cuánto de ese valor obtuvo: `nota ÷ puntos × valor` | `%` | Sacó 84/100 → **29,40%** |
| **NOTA FINAL** | La **suma** de la columna Calificación | `x/100%` | **90/100%** |

> **Regla de oro:** la calificación se expresa **en porcentaje, nunca en puntos
> crudos**. Si vale 35% y le fue bien, la celda dice `31,50%` — no "9/10", no
> "31,5 de 35", no "90". Así la nota final es una suma que el docente verifica de
> cabeza, que es como se hace en papel.

Los **rubros del MEP** (Trabajo cotidiano 45%, Pruebas 40%…) siguen existiendo:
son el presupuesto que reparte el docente, y aparecen como **subtotal** debajo de
la tabla. Pero no organizan la vista del estudiante: esa es una lista plana de
actividades, como en la UISIL.

### 3.2 Las fórmulas

```
Por actividad calificada:
    calificación %  = (nota / puntos) × valor %
    si entrega tardía:  × (1 − penalización/100)

Del periodo:
    NOTA FINAL = Σ calificación %   de las actividades calificadas
    Evaluado   = Σ valor %          de las actividades calificadas

Subtotal por rubro (para el registro del MEP):
    obtenido_rubro = Σ calificación % de sus actividades
```

Redondeo (**D4**): 2 decimales en el periodo; solo el promedio anual se redondea
a entero.

### 3.3 Estudiante — pestaña "Evaluación" (escritorio)

```
Evaluación
Entregas, pruebas y proyectos del I Periodo.                    I Periodo ▾

 Tipo   Actividad                          Fecha/Hora entrega    Estado        Valor %  Calificación
 ────── ────────────────────────────────── ───────────────────── ───────────── ──────── ────────────
  ▣     Cotidiano #3 — Funciones           13/06/2026 23:59:59   ✓ Entregada     15%       12,00%
        Entrega · Trabajo cotidiano · Semana 4
  ▣     Mapa conceptual                    20/06/2026 23:59:59   ✓ Entregada     10%        8,00%
        Entrega · Tareas · Semana 5
  ◆     Examen I Periodo                   27/06/2026 23:59:59   Sin entregar    40%          —
        Prueba · Pruebas
  ▣     Taller de ecuaciones               04/07/2026 23:59:59   ✓ Entregada      5%   [No revisado]
        Entrega · Trabajo cotidiano
  ✓     Asistencia                         —                     Automática       5%        4,50%
 ────── ────────────────────────────────── ───────────────────── ───────────── ──────── ────────────
                                                          NOTA FINAL:  24,50/100%
                                                          Evaluado hasta hoy: 30%

 Resumen por rubro
 Trabajo cotidiano   45%    12,00%      Pruebas      40%     0,00%
 Tareas              10%     8,00%      Asistencia    5%     4,50%
```

Puntos que importan y que antes no tenía:

- **Columna Tipo** con un ícono discreto: `▣` Entrega, `◆` Prueba, `≡` Proyecto.
- **Segunda línea en itálica gris** bajo el título: `Tipo · Rubro · Clase a la que
  pertenece`. Es lo que la UISIL hace con "Entrega-Pertenece a la clase: Semana 1".
- **Estado** con marca verde: `✓ Entregada`, `Sin entregar`, `Entregada tarde`.
- **`[No revisado]`** como pastilla gris cuando se entregó pero no se ha calificado.
  No se inventa ningún promedio.
- Sin líneas verticales; solo separadores horizontales tenues.
- Al hacer clic en la fila se abre el **detalle de la actividad** (§3.5).

### 3.4 Estudiante — la misma tabla en celular (390 px)

No se convierte en tarjetas grandes. Se compacta manteniendo el aire de tabla:

```
 I Periodo ▾

 ▣  Cotidiano #3 — Funciones            15%
    Entrega · Trabajo cotidiano       12,00%
    13/06 23:59 · ✓ Entregada
 ──────────────────────────────────────────
 ▣  Mapa conceptual                     10%
    Entrega · Tareas                   8,00%
    20/06 23:59 · ✓ Entregada
 ──────────────────────────────────────────
 ◆  Examen I Periodo                    40%
    Prueba · Pruebas                       —
    27/06 23:59 · Sin entregar
 ──────────────────────────────────────────
 NOTA FINAL                       24,50/100%
 Evaluado hasta hoy: 30%
```

### 3.5 Estudiante — detalle de una actividad

Copia la estructura de la UISIL: primero el veredicto, después los datos.

```
← Evaluación
Cotidiano #3 — Funciones

┌─ Revisión ───────────────────────────────────────────────┐
│  Obtuviste:  12,00 / 15 %                                │
│  Fecha de revisión: 15/06/2026 19:38                     │
│                                                          │
│  Retroalimentación del docente                           │
│  "Buen desarrollo, revisá el paso 3."                    │
│                                                          │
│  Tu entrega — registrada el 13/06/2026 11:51             │
│  📎 cotidiano3.pdf     📎 foto1.jpg                       │
└──────────────────────────────────────────────────────────┘

┌─ Datos generales ────────────────────────────────────────┐
│  Tipo de actividad        Entrega                        │
│  Rubro                    Trabajo cotidiano              │
│  Clase a la que pertenece Semana 4 — Funciones           │
│  Fecha y hora de entrega  13/06/2026  23:59:59           │
│  Valor porcentual         15%                            │
│  Descripción              …                              │
│  Material del docente     📎 rubrica.pdf                  │
└──────────────────────────────────────────────────────────┘

┌─ Rúbrica de evaluación ──────────────────────────────────┐
│  Criterio                                        Puntos  │
│  Procedimiento completo                               5  │
│  Orden y presentación                                 3  │
└──────────────────────────────────────────────────────────┘
```

Cuando todavía no entregó, el bloque de Revisión se reemplaza por el de **subir
archivos**, con la fecha límite visible y el aviso de si acepta tardías.

### 3.6 Docente — registro de calificaciones

> **Corregido el 2026-07-26, después de verlo con datos reales.** El boceto de
> abajo pone **una columna por actividad**. Con 7 actividades la tabla ya no
> cabía en pantalla y los títulos había que recortarlos («Cotidiano #2 — Fra…»);
> con 20 sería ilegible. Y para leer un registro uno quiere el **subtotal del
> rubro**, que es lo que pide el MEP, no cada tarea suelta.
>
> **Lo vigente:** las columnas son los **rubros** (`Trabajo cotidiano 45% ·
> Tareas 10% · Pruebas 40% · Asistencia 5% · NOTA`). Caben siempre, sin recortar
> ningún texto. **El detalle no se pierde:** al tocar la fila de un estudiante
> se despliegan sus actividades agrupadas por rubro, con el Valor % y la
> calificación de cada una.
>
> Dos cosas más que salieron de la misma revisión:
> - **El color ya no miente.** Se pintaba de rojo toda nota bajo el mínimo, y a
>   mitad de periodo eso es falso: con un 55% evaluado nadie llega a 65 todavía,
>   así que el grupo entero aparecía reprobando. Ahora verde = ya aprobó, rojo =
>   ya no le alcanza ni sacando todo lo que falta, tinta = se define
>   (`lib/notas.js → estadoAprobacion`).
> - **El registro abre en el periodo de HOY**, no siempre en el I (§3.9).

La misma lógica, transpuesta: estudiantes en filas, actividades en columnas.

```
Notas · I Periodo ▾              Evaluado: 30 de 100%    [⬇ Excel] [⬇ Respaldo]

 Estudiante        Cotidiano #3   Mapa conc.   Examen I   Asistencia   NOTA
                       15%            10%         40%          5%      /100%
 ───────────────── ────────────── ──────────── ─────────── ──────────── ───────
 Ana Rojas             12,00%        8,00%         —          4,50%     24,50%
 Luis Mora              9,00%        5,00%         —          5,00%     19,00%
 Sofía Vega            13,50%        9,00%         —          4,50%     27,00%
 ───────────────── ────────────── ──────────── ─────────── ──────────── ───────
 Promedio grupo        11,50%        7,33%         —          4,67%     23,50%
```

Con muchas actividades la tabla se desplaza en horizontal con la columna
Estudiante fija. En celular, una fila por estudiante que se despliega.

### 3.9 Publicar las notas cuando el docente quiera

Pedido del 2026-07-26. El docente suele querer terminar de calificar a **todo**
el grupo antes de que nadie vea su nota; si no, el primero en ser revisado ya
anda preguntando.

- Es **por periodo**: se publica el I y se deja el II oculto mientras se
  califica. Columna `grupos.notas_ocultas` (jsonb, lista de periodos ocultos).
  Vacío = publicado, así que **los grupos que ya existían no cambian**.
- El interruptor va **junto al selector de periodo** del registro, con un ícono
  de ojo. No en una caja aparte: ocupaba media pantalla para una sola decisión.
- El estudiante **sigue viendo qué entregó y cuándo**; lo que se guarda es la
  calificación, en la lista, en el total, en el resumen por rubro y en el
  detalle de la actividad. Se le dice por qué, no se le deja la celda muda.

> **Alcance honesto:** esto es **presentación, no secreto**. La nota sigue en la
> base y RLS no puede tapar una sola columna de una fila que el estudiante tiene
> derecho a ver. Sirve para «todavía no», no para información confidencial.

### 3.10 El periodo que se abre por defecto

El docente pasaba lista un 25 de julio, entraba a Notas —que abría siempre en el
I Periodo— y no veía reflejada la asistencia: en un grupo de dos periodos, esa
fecha cae en el II. Parecía que el sistema no guardaba nada.

- `lib/periodos.js → periodoDeFecha(grupo, fecha)` resuelve a qué periodo
  pertenece un día, usando las fechas que cargó el docente y, si no las cargó,
  el reparto del año lectivo.
- El registro del docente y la Evaluación del estudiante **abren en el periodo
  de hoy**.
- El pase de lista dice, debajo del campo de fecha, **para qué periodo cuenta**
  ese día.

### 3.11 Asistencia por lección y fuga (Arts. 37 y 154)

Pedido del 2026-07-26, después de leer el reglamento de nuevo.

**El problema.** El Art. 37 dice *«el número total de **lecciones impartidas**»*,
y PuraNota guardaba **una marca por día**. Coincide mientras todos los días
tengan la misma cantidad de lecciones; deja de coincidir con bloques desiguales
—lunes 2 lecciones y miércoles 4—, que en secundaria son comunes: faltar un
miércoles debe pesar el doble.

**La solución.** `grupos.lecciones_por_dia` = `{"1":2,"3":4}` (1 = lunes … 5 =
viernes). Se configura **una sola vez**, desde un bloque plegado en la pestaña
Asistencia. El pase de lista no cambia: se sigue marcando una vez por día, pero
cada marca pesa lo que corresponde. **Vacío = cada día pesa 1**, así que ningún
grupo existente cambia de comportamiento.

**Fuga (F).** El estudiante estuvo y se fue antes de terminar el bloque. No es
ausencia del día entero: se guarda `asistencia.lecciones_perdidas` y esas
lecciones cuentan como **ausencias injustificadas** (Art. 37), mientras las que
sí estuvo cuentan presente. El selector de cuántas perdió aparece solo si el día
tiene más de una lección.

> **Lo que decide el reglamento, no nosotros.** La fuga es **falta leve de
> conducta** (Art. 154 inciso d) y corresponde amonestación verbal o escrita. El
> mismo artículo, inciso e, aclara que las ausencias reguladas por los Arts. 36
> y 37 **no** son falta de conducta: van por la vía de la asistencia. Por eso
> PuraNota descuenta las lecciones perdidas de la nota **y avisa** que además
> hay una falta que atender — pero **no gestiona conducta**: esa nota la
> determina el conjunto de docentes de la sección (Art. 4351), y está fuera de
> alcance.

### 3.7 Los 3 errores que se corrigen en la misma pasada

Documentados en `CLAUDE.md` §7.6:

- **Penalización fantasma:** una prueba escrita calificada después de la fecha
  límite se rebaja 10% sola.
- **Actividades con `porcentaje` nulo:** no cuentan y no avisan.
- **La leyenda del cuadro del docente** describe algo distinto de lo que muestra.

### 3.8 Cómo se garantiza que no se vuelva a romper

Batería de pruebas con el ejemplo de arriba y ~40 casos más: rubro sin calificar,
entrega tardía, actividad huérfana, porcentaje nulo, asistencia escalonada del
MEP, rubro renombrado, periodo vacío, división por cero. Corren en 2 segundos con
`npm test`. **Si un cambio rompe una nota, lo sabés antes de subirlo.**

---

## 4. El plan, por bloques

Con honestidad: todo esto no cabe en un día. Lo que sí cabe hoy es el bloque 0.

### 🔴 BLOQUE 0 — HOY (≈ 4 h)

| # | Tarea | Tiempo | Quién |
|---|---|---|---|
| 0.1 | `git init`, `.gitignore` que excluya `.env`, primer commit, **repo privado en GitHub** | 20 min | yo + vos |
| 0.2 | **Keep-alive doble externo** (5 min y 6 h) | 15 min | vos |
| 0.3 | **Respaldo automático de la base** (script + tarea semanal) | 40 min | yo |
| 0.4 | **Pestaña Evaluación del estudiante** según §3.3–3.5, incluida la columna `tipo` (D13) | 2 h | yo |
| 0.5 | **Registro del docente** según §3.6 + los 3 errores de §3.7 | 1 h | yo |

### 🟠 BLOQUE 1 — ESTA SEMANA (≈ 2–3 días)

Pruebas automáticas de notas · migración a `rubro_id` · proyecto de staging con
datos masivos · **respaldo automático semanal en GitHub Actions (§5)** ·
export a Excel en la app · **despliegue en Cloudflare Pages con `noindex` (§10.2)**
· módulo admin.

### 🟡 BLOQUE 2 — SIGUIENTE (≈ 3–4 días)

Pestañas Recursos y Ausencias/Tardías · **Foros (§8.1)** · Mi historial (§8.2) ·
**página pública e indexación en Google y Bing (§10.3)** · 6 flujos automatizados
en navegador real · pasada de diseño y accesibilidad.

### ⚪ BLOQUE 3 — DESPUÉS

Mensajería, pre-revisión con IA, notificaciones, app instalable.

---

## 5. Resguardo automático (sin pagar Supabase Pro, sin depender de vos)

**Requisito:** que si no te acordás de nada durante seis meses, igual haya
respaldos. Todo corre **en la nube**, no en tu computadora.

### Cómo funciona

Un **GitHub Action programado** que corre solo todos los domingos, desde el
repositorio **público** de código, pero que **escribe en un repositorio privado
aparte** (D16):

```
Domingo 06:00   (Action en  puranota  → escribe en  puranota-respaldos, privado)
  1. supabase db dump            → puranota-AAAA-MM-DD.sql   (todo: estructura + datos)
  2. genera CSV de notas          → notas-<grupo>-<periodo>.csv  (uno por grupo/periodo)
  3. cifra ambos con la clave del secret
  4. commit + push al repositorio PRIVADO de respaldos
  5. borra los respaldos de más de 6 meses
  6. si algo falla → te llega correo de GitHub
```

> **Regla que no se rompe:** en `puranota` (público) **no entra ni un dato de
> estudiante**, ni siquiera cifrado. Los secretos del Action (contraseña de
> cifrado, token de acceso al repositorio privado, credenciales de la base) viven
> en *GitHub Secrets*, que no son visibles aunque el repositorio sea público.

Ventajas sobre lo que teníamos pensado: **no depende de que la PC esté
encendida**, no depende de que te acordés, queda con fecha e historial, y el
correo de fallo te avisa si algún domingo no corrió.

### Las tres capas

| Capa | Qué guarda | Cuándo | Para qué sirve |
|---|---|---|---|
| **1. Código** | Todo el proyecto | En cada cambio | Que un disco dañado no borre meses de trabajo |
| **2. Base completa** | `.sql` con estructura y datos | Domingos, automático | Levantar el sistema entero en un proyecto nuevo |
| **3. Notas en planilla** | `.csv` por grupo y periodo | Domingos, automático | Que las notas se puedan **abrir y leer sin la app**, aunque PuraNota no exista |

Y además el botón **"Descargar Excel"** dentro de la app, para cuando lo querés
en el momento y con formato bonito (el automático es CSV porque no necesita
librerías y Excel lo abre igual — menos piezas que se puedan romper).

### ⚠️ Privacidad: esto no es opcional

El respaldo contiene **nombres, correos, teléfonos y notas de menores de edad**.
Por eso:

- El repositorio de **respaldos** va **privado**, nunca público, con verificación
  en dos pasos. El de **código** es público y no lleva ni un dato (D16).
- Los archivos de respaldo van **cifrados** con una contraseña guardada como
  *secret* de GitHub. Sin esa contraseña no se abren, ni siquiera con acceso al
  repositorio.
- **Guardá esa contraseña en un lugar seguro** (gestor de contraseñas, no un
  papel). Es el único punto donde vos sí sos indispensable: si la perdés, los
  respaldos quedan inservibles.

### El peor escenario, resuelto

Supabase pausado, borrado o perdido → creás un proyecto nuevo gratis, descifrás
el último `.sql`, lo corrés, y estás de vuelta **en 20 minutos**. Y aunque no
tuvieras cómo levantar el sistema, las notas de tus estudiantes están en un CSV
que abre cualquier computadora. **Eso** es no depender del plan de pago.

> **Nota honesta:** GitHub desactiva las tareas programadas tras 60 días sin
> actividad en el repositorio. Como esta tarea *hace commits* y vos vas a estar
> subiendo cambios, en la práctica no se apaga — pero si alguna vez el proyecto
> queda quieto medio año, revisá que siga corriendo. Por eso el keep-alive de
> Supabase va en un servicio aparte (§6) y no depende de GitHub.

---

## 6. Que Supabase no se pause nunca más

Detalle en [`docs/keep-alive.md`](./keep-alive.md).

- **Falló porque** el ping era 1 vez al día (insuficiente) y la GitHub Action
  nunca corrió: el proyecto no estaba en git.
- **UptimeRobot cada 5 min** (~288 consultas reales/día). URL ya verificada: `200`.
- **cron-job.org cada 6 h** como segundo servicio independiente.
- Tarea de Windows de tercer respaldo, subida a cada 6 h.
- Con el respaldo de §5, aunque se pausara, no perdés nada.

---

## 7. Módulo de administrador

Rol nuevo `admin` en `perfiles.rol`. Tu usuario es el único. Ruta `/admin`:

| Pestaña | Qué hace |
|---|---|
| **Resumen** | Docentes, estudiantes, grupos, entregas y actividad de 30 días. |
| **Docentes** | Crear docente con clave temporal, suspender, resetear clave, convertir un estudiante en docente. |
| **Usuarios** | Buscar cualquier usuario, ver sus grupos, resetear clave, eliminar. |
| **Sistema** | Descargar respaldo, estado del keep-alive, errores recientes. |

Todo el poder vive en **una sola Edge Function** que primero verifica que quien
llama es admin. Si algún día hay una falla, hay un archivo que revisar, no trece.

---

## 8. El grupo del estudiante: 4 pestañas formales

Hoy: Asignaciones · Clases · Notas. Se siente vacío y además está mal repartido:
"Asignaciones" y "Notas" son la misma lista vista dos veces. La UISIL lo resuelve
mejor y lo copiamos.

| Pestaña | Qué es | Estado |
|---|---|---|
| **Clases** | Las clases en tarjetas, con su contenido, video y adjuntos. Adentro: `Contenido · Material adjunto`. | ya existe, se pule |
| **Evaluación** | **La tabla de registro** (§3.3). Reemplaza a "Asignaciones" **y** a "Notas": desde acá se ve el estado, se entra a entregar y se ve la calificación. Una sola verdad. | rehacer |
| **Recursos** | Todos los videos, enlaces y archivos del grupo en una lista, con `Video de YouTube · compartido por: …`. Incluye **enlaces web sueltos**, que hoy no se pueden agregar. | nuevo |
| **Ausencias / Tardías (2)** | Tabla `Fecha · Estado · Comentario del docente · Comentario del estudiante` con botón **Enviar justificación**, y el contador en la pestaña. | nuevo |

Y en el **dashboard** del estudiante (fuera del grupo): **Pendientes** de todos
los grupos ordenados por urgencia, y los **Avisos**, que ya existen.

Dos cosas que esto necesita de la base, ambas aditivas:
- `clase_archivos.tipo = 'enlace'` (o una tabla `recursos`) para enlaces web.
- `asistencia.comentario_docente` y `asistencia.justificacion` para el flujo de
  justificación.

**Descartado por ahora:** Salón virtual (no hay clases en vivo), Mensajería
(bloque 3), Bibliografía (se fusiona con Recursos).

### 8.1 Foros — una actividad más, no un módulo aparte

La clave de cómo lo hace la UISIL: **el foro no es un chat, es una actividad
calificable**. Aparece en la tabla de Evaluación con su Valor %, su fecha, su
estado y su calificación, igual que una entrega. Eso significa que en PuraNota
**no hay que inventar nada nuevo para calificarlo**: se reusa `entregas`, se reusa
la revisión, se reusa el cálculo de notas.

**Modelo de datos** (aditivo, sin tocar nada existente):

```sql
alter table public.asignaciones
  add column tipo text not null default 'entrega'
    check (tipo in ('entrega','prueba','proyecto','foro')),
  add column foro_config jsonb not null default '{}'::jsonb;
  -- { minAportes: 1, minRespuestas: 2, verAntesDeAportar: false }

create table public.foro_mensajes (
  id            uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references public.asignaciones(id) on delete cascade,
  autor_id      uuid not null references public.perfiles(id) on delete cascade,
  padre_id      uuid references public.foro_mensajes(id) on delete cascade, -- null = aporte raíz
  contenido     text not null,
  editado_en    timestamptz,
  creado_en     timestamptz not null default now()
);
```

**Un solo nivel de anidamiento**, como la UISIL: un aporte y sus respuestas. Nada
de árboles infinitos — en celular son ilegibles.

**El truco que lo integra con las notas.** Un trigger: cuando el estudiante
publica su **primer aporte raíz**, se crea sola su fila en `entregas` con
`entregado_en` = ese instante. Es literalmente lo que muestra la UISIL: *"Se
registró la entrega de esta actividad el: 23/05/2025 17:40:39"*. Con eso:

- el trigger de tardías existente funciona sin tocarlo,
- la tabla de Evaluación lo muestra sin código especial,
- el docente lo califica en la misma pantalla de Revisión que todo lo demás,
- el cálculo de notas no se entera de que es un foro.

**Lo que vale la pena agregar y la UISIL no tiene.** La consigna decía *"debe
retroalimentar a dos compañeros"* y alguien tuvo que contarlo a mano. PuraNota
puede contarlo solo:

> **Tu participación:** 1 de 1 aporte ✓ · 1 de 2 respuestas a compañeros ✕

Y en la pantalla de revisión del docente, una columna `Aportes / Respuestas` por
estudiante. Eso le ahorra al profe la parte más tediosa de calificar un foro.

**Opción anti-copia:** `verAntesDeAportar: false` oculta los aportes de los demás
hasta que el estudiante publique el suyo. Es una casilla en el formulario.

**Reglas de permisos (RLS):**

| Quién | Puede |
|---|---|
| Estudiante | Ver el foro si es miembro activo y la actividad es visible. Escribir solo con su propio `autor_id`, y solo mientras el foro esté **abierto**. Editar y borrar **solo lo suyo**, y solo antes del cierre. |
| Docente | Ver todo siempre. **Borrar cualquier mensaje** (moderación — son menores de edad, esto no es opcional). Cerrar el foro antes de tiempo. |

**Detalle de la UI que hay que copiar tal cual:** cuando el foro cierra, los
botones no desaparecen — se convierten en texto gris: *"Ya no puedes responder"*,
*"Ya no puedes editar"*. El estudiante entiende **por qué** no puede, en vez de
buscar un botón que no está.

**En celular:** las respuestas se indentan con una **línea vertical a la
izquierda**, que además calza con la línea de margen rojo que ya es la firma
visual de PuraNota.

**Cómo se ve** (capturas `175758` y `175814`). Es un **modal a dos columnas**, no
una página:

```
 Actividad                                                          [ Cerrar ]
 ┌──────────────────────────┬─────────────────────────────────────────────────┐
 │ Datos generales          │  Parámetros de la actividad                     │
 │                          │  ┌───────────────────────────────────────────┐  │
 │ Nombre                   │  │ Revisión                                  │  │
 │ [Foro: Solo Tecnología…] │  │        Obtuviste: 5/5 %                   │  │
 │ Tipo de actividad        │  │        Fecha de revisión: 01/08 19:02     │  │
 │ [Foro           ▾]       │  │  ──────────────────────────────────────   │  │
 │ Clase a la que pertenece │  │  Retroalimentación del docente…           │  │
 │ [No asignada    ▾]       │  └───────────────────────────────────────────┘  │
 │ Fecha de entrega         │                                                 │
 │ [23/05/2025]             │  Adjuntos —  No hay archivos adjuntos           │
 │ Hora de entrega          │        ✅ Se registró la entrega el:            │
 │ [23:59:59]               │           23/05/2025 17:40:39                   │
 │ Valor porcentual         │                                                 │
 │ [5]                      │  ┌─ hilo ────────────────────────────────────┐  │
 │ Porcentaje disponible: 0 │  │ (◕) MAX ANTONIO SOLIS · 23/05 23:20:46    │  │
 │                          │  │     texto del aporte…                     │  │
 │ Evaluación:              │  │     Ya no puedes responder                │  │
 │ (la consigna: preguntas  │  └───────────────────────────────────────────┘  │
 │  1, 2, 3 y la regla de   │  ┌───────────────────────────────────────────┐  │
 │  retroalimentar a 2)     │  │ (◕) MARIA JESUS HERNANDEZ · 23/05 18:52   │  │
 │                          │  │     …                                     │  │
 └──────────────────────────┴─────────────────────────────────────────────────┘
```

Detalles a copiar:
- **Cada mensaje es una tarjeta** con **avatar circular**, `NOMBRE EN MAYÚSCULAS`
  en negrita, `·`, y la fecha/hora completa. El cuerpo respeta los saltos de línea.
- El bloque de **Revisión va destacado en color** (allá azul; en PuraNota, verde
  pizarra) porque es lo primero que el estudiante busca.
- **Marca verde ✅ + "Se registró la entrega de esta actividad el: …"**.
- Los estados bloqueados van en **itálica gris dentro de la tarjeta**, no como
  botones deshabilitados.
- Botón **Cerrar** abajo a la derecha del modal.

**Adaptación a móvil (D12).** El modal de dos columnas no funciona en 390 px. Se
apila en este orden, que es el de importancia real para el estudiante:

1. **Revisión** (su nota y la retroalimentación),
2. **Consigna** (las preguntas del foro),
3. **Tu participación** (contador + caja para escribir),
4. **El hilo**,
5. **Datos generales**, plegado.

**Esfuerzo estimado:** ~1 día (tabla + RLS + trigger + servicio + pantalla del
estudiante + columna en la revisión del docente). Va en el **bloque 2**.

### 8.2 Bonus de las capturas: "Mi historial"

La pantalla **Historial académico** de la UISIL (captura `174929`) es una tabla
`Código · Bloque · Nombre · Créditos · Nota · Periodo · Estado(Aprobado)`.

Traducido al MEP, esa es la vista **"Mi historial"** del estudiante: sus materias
con la **nota final de cada periodo** y el estado **Aprobado / Aplazado** según el
umbral (65 o 70, `lib/mep.js`). Reemplaza a lo que yo había llamado "Mi progreso
del año" y ahora tiene un formato concreto que copiar. Va en el **bloque 2**,
junto a Recursos.

---

## 9. Pruebas masivas: qué es realista con IA

**Lo que sí ahorra días:** escribir las pruebas, generar los datos falsos y los
guiones que manejan el navegador. Una tarde en vez de una semana.

**Lo que no:** decidir qué está bien. Puedo escribir 200 pruebas, pero alguien
tiene que decir "la nota de Ana debe dar 24,50%". Ese "debe dar" sale de §3, y
por eso §3 se aprueba primero.

1. **Vitest** sobre `lib/notas.js`, `lib/mep.js`, `lib/periodos.js` — ~60 casos,
   2 segundos. **Acá está el 80% del valor.**
2. **Seed masivo** en staging: 3 grupos, 90 estudiantes, 60 actividades, entregas,
   notas y meses de asistencia. Un comando.
3. **Playwright**: 6 recorridos reales, incluido el más importante de todos —
   **que la nota que ve el estudiante sea idéntica a la del docente**.

---

## 10. Despliegue e indexación (son dos cosas distintas)

Conviene separarlas, porque una va **temprano** y la otra **al final**.

### 10.1 Navegadores ≠ buscadores

Aclaración importante: **Chrome y Edge son navegadores, no buscadores.**

- **Que la app funcione** en Chrome, Edge, Safari, Firefox y en celular: eso ya
  está resuelto por el stack, no hay que hacer nada especial. Se verifica en la
  pasada de pruebas.
- **Que aparezca en las búsquedas** depende de los **buscadores**, y son dos los
  que importan:
  - **Google** → es el buscador por defecto de Chrome. Se registra en *Google
    Search Console*.
  - **Bing** → es el buscador por defecto de Edge, y además alimenta a Yahoo y
    parcialmente a DuckDuckGo. Se registra en *Bing Webmaster Tools*.

Con esos dos registros, gratis, cubrís prácticamente el 100% de las búsquedas en
Costa Rica, sin importar el navegador que use la persona.

### 10.2 Despliegue → **temprano** (bloque 1)

Recomiendo adelantarlo, no dejarlo al final. Motivos concretos:

- Te da una **dirección web real** para abrir en tu celular y probar de verdad.
  Todo el trabajo mobile-first (D12) se hace mucho mejor así que con `localhost`.
- Te da el flujo que pediste: **subís un cambio y se publica solo**, sin comandos.
- No cuesta casi nada: Cloudflare Pages se conecta al repositorio y listo.
- Mientras tanto va con **`noindex` en todo**, así que nadie lo encuentra por
  accidente ni Google indexa un producto a medio hacer.

### 10.3 Indexación → **al final** (bloque 2)

Porque necesita que exista antes la página pública y que el producto esté
presentable. Y porque igual **tarda semanas**, así que apurarla no sirve de nada.

1. **Página pública** en `/` con contenido real, pensada para quien busca
   "plataforma para docentes MEP Costa Rica". Hoy `/` manda directo al login:
   **Google no puede indexar lo que está detrás de un login.**
2. **Metadatos**: título, descripción, vista previa al compartir por WhatsApp
   (que es como se va a compartir), ícono, idioma `es-CR`.
3. **`robots.txt` + `sitemap.xml`**: indexar la página pública, **`noindex` en
   toda la app** (`/docente`, `/estudiante`, `/admin`).
4. **Registrar en Google Search Console y en Bing Webmaster Tools**, y pedir la
   indexación en ambos.
5. **Dominio**: `pages.dev` funciona y se indexa. Uno propio (~$12/año) da más
   confianza a los docentes y posiciona mejor. **Recomiendo el propio**, pero no
   bloquea nada — se puede cambiar después sin rehacer.

---

## 11. Qué significa "impecable", de forma verificable

Una vista está terminada cuando cumple las 10:

1. Se ve bien en **390 px** sin scroll horizontal.
2. Se ve bien en **1440 px** sin quedar como una columnita.
3. Todo lo tocable mide **≥ 44 px**.
4. Se recorre con teclado, con foco visible.
5. Contraste AA en claro **y** oscuro (ningún `bg-white` suelto).
6. Tiene sus 4 estados: cargando, vacío, error, con datos.
7. Las tablas anchas se desplazan con la primera columna fija, o se compactan
   manteniendo forma de tabla — **no se convierten en tarjetas grandes**.
8. Ninguna acción destructiva sin confirmación.
9. Todo porcentaje lleva su signo `%` y sus 2 decimales.
10. Respeta `prefers-reduced-motion`.

---

## 12. Lo que NO vamos a hacer todavía

- ❌ Pre-revisión con IA — bloque 3. Sin pruebas ni respaldos es construir sobre arena.
- ❌ Mensajería / chat / notificaciones push.
- ❌ Salón virtual con clases en vivo y grabaciones.
- ❌ App móvil nativa. Una PWA instalable hace el 95%.
- ❌ Migrar de Supabase o de React.
- ❌ Pagar Supabase Pro.
- ❌ TypeScript.

---

## 13. Tu visto bueno

**A. Decisiones (§2).** ¿Aprobás D1 a D12? Si alguna no, decime cuál y por qué.

**B. La pantalla de Evaluación (§3.3 a §3.6).** ¿Así sí? Es el momento de decirlo.

**C. El orden (§4).** ¿Arrancamos con el bloque 0?

**D. Cuentas que abrís vos** (5 min): GitHub · UptimeRobot · cron-job.org ·
segundo proyecto Supabase gratis `puranota-staging`.

**E. ¿Dominio propio** (~$12/año) **o `pages.dev`?**

---

## Lo que ya está hecho (2026-07-25)

### Bloque 0 — completo

| | |
|---|---|
| **Control de versiones** | Repositorio **público** `Jefernee/puranota` + repositorio **privado** `Jefernee/puranota-respaldos` (D16). `.env` e `imagenes/` fuera del control de versiones. |
| **Keep-alive** | Tres capas: UptimeRobot cada 5 min (verificado en los registros de Supabase), GitHub Action dos veces al día, tarea de Windows. |
| **Respaldo automático** | Action semanal cifrado con AES256, **probado de punta a punta**: el volcado trae 13 tablas, 13 bloques de datos y 29 políticas RLS. Descifrado verificado. |
| **Notas reescritas** | Modelo de registro (§3), con 17 comprobaciones sobre el caso del plan. |
| **Los 3 errores de notas** | Penalización fantasma, actividades sin Valor % y la leyenda equivocada: corregidos. |
| **`asignaciones.tipo`** | Migración aplicada (D13). |

### Bloque 1 — parcial

| | |
|---|---|
| **Despliegue** | Publicado en `puranota.pages.dev` con `noindex`, verificado: rutas profundas sin 404, variables de entorno en el build, cabeceras de seguridad. Cada push publica solo. |
| **Pruebas automáticas (D8)** | **165 comprobaciones** con Vitest sobre `notas`, `mep`, `periodos` y `entregas`, en 1,2 s. Incluyen el caso de referencia de §3.3 y los tres errores de §3.7. Se validaron rompiendo el código a propósito en cuatro puntos: las cuatro mutaciones fueron detectadas. |
| **Staging (D9)** | Segundo proyecto Supabase (US$0) con el esquema espejo de producción y **datos masivos**: 94 usuarios, 4 grupos, 43 actividades, 735 entregas y ~5.000 asistencias. Se entra con `npm run dev:staging`. Ver [`staging.md`](./staging.md). |
| **Esquema al día** | `backend/esquema.sql` regenerado desde el catálogo y verificado contra un proyecto vacío (13 tablas, 110 columnas, 29 políticas, 9 funciones, 4 triggers, 43 restricciones). |
| **Pendiente** | migración a `rubro_id` (D5) · export a Excel · módulo admin · Playwright |

### Pasada de interfaz (dos tandas)

Reglas nuevas, documentadas en `CLAUDE.md` §5.5 y §5.6:

- **Registro, no tarjetas.** Detalle de la actividad rehecho con bloque de
  Revisión, tabla de Datos generales y galería de archivos uniforme.
- **Sin emoji decorativos** ni caracteres tipográficos como íconos → `IconoTipo.jsx`.
- **Color que informa o no está.** Fuera el arcoíris de la barra de rubros y el
  morado decorativo. Token `ambar` nuevo (las advertencias eran ilegibles en oscuro).
- **Tipografía mínima de 13 px**, cuerpo en 15–16, títulos de 18 px en celular.
- **Textos completos**, sin recorte, en 12 componentes.
- **Lo tocable parece tocable**: fila entera, flecha, respuesta al toque.
- **Celular compacto**: 16 px de relleno en vez de 48; encabezados y filtros rehechos.
- **Defensas contra el desborde** en la base del CSS + `DetectorDesborde.jsx`.

### Pendientes de configuración (5 minutos, los hace el docente)

- **CORS de Cloudflare R2** para `https://puranota.pages.dev` — sin esto, subir
  archivos falla **solo en producción**.
- **URLs de autenticación en Supabase** — sin esto, el correo de recuperación
  sigue mandando a `localhost`.

Ambos están detallados en [`despliegue.md`](./despliegue.md) §2.

---

## Registro de cambios

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-07-25 | v1 inicial | Cerrar el ciclo de cambios de idea |
| 2026-07-25 | **v3** — se agrega "Lo que ya está hecho": bloque 0 completo, despliegue en línea y las dos tandas de interfaz. Reglas nuevas en CLAUDE.md §5.5 y §5.6. | Dejar por escrito el estado real |
| 2026-07-25 | **v2** — reescrito §3 completo: tabla de registro en vez de tarjetas y barras; una sola NOTA FINAL; vocabulario Valor%/Calificación. Nuevo §3.0 y §3.5. §8 reestructurado a 4 pestañas. | Revisión del Aula Virtual de la UISIL (capturas en `imagenes/`) |
