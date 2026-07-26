# Reglamento MEP para PuraNota — REAC 2026 (verificado)

Documentos oficiales del **Reglamento de Evaluación de los Aprendizajes y de la Conducta (REAC)**,
Decreto Ejecutivo **N° 45509-MEP**, reforma integral al 40862-MEP, aprobado por el Consejo Superior
de Educación (sesiones 09-2026 y 12-2026, febrero 2026), **vigente desde el curso lectivo 2026**.

Todos los datos de este resumen están **verificados contra el texto oficial** (no contra notas de
prensa, que contienen errores — ver más abajo).

## Archivos en esta carpeta

- `REAC-2026-oficial-mep.pdf` — texto consolidado oficial (fuente: pgrweb.go.cr / SCIJ, vía mep.go.cr). **Es el que se sirve en la app** (copiado a `frontend/public/reglamento-mep-2026.pdf`).
- `REAC-2026-decreto-45509-MEP.pdf` — versión con formato de La Gaceta (espejo).
- `REAC-2026-texto.txt` — texto plano completo (extraído con pdftotext, ~5000 líneas) para búsquedas rápidas.

## ⚠️ Errores de prensa desmentidos contra el texto oficial

1. **Nota mínima de aprobación NO es 75.** El **Art. 47** dice: **≥ 65** en I, II y III Ciclo; **≥ 70** en
   Educación Diversificada (y 70 en colegios bilingües de III Ciclo). Varios medios dijeron "subió a 75" — falso.
2. **Primaria (I/II Ciclo académicas):** el texto real es Trabajo cotidiano **50%**, Tareas **10%**,
   Pruebas **35%**, Asistencia **5%**. La prensa reportó "Tareas 50%" cambiando los nombres.

## Asistencia (Arts. 36 y 37) — vale 5% en TODOS los niveles

Se computa **por lección, por asignatura, por periodo**. La nota de asistencia es una **tabla
escalonada** según el **% de ausencias INJUSTIFICADAS** sobre el total de lecciones impartidas:

| Ausencias injustificadas (% del total de lecciones) | Puntos |
|---|---|
| 0% a menos de 10% | 5% |
| 10% a menos de 20% | 4% |
| 20% a menos de 30% | 3% |
| 30% a menos de 40% | 2% |
| 40% a menos de 50% | 1% |
| 50% o más | 0% |

- **Tardía injustificada < 10 min = 0.5 ausencia; ≥ 10 min = 1 ausencia.**
- Ausencias y tardías **justificadas NO cuentan** para la escala (justificación por escrito, ≤ 3 días hábiles; causas de fuerza mayor/caso fortuito, Art. 36).
- **Regla del 80% (Art. 54):** para presentar pruebas de ampliación hay que haber asistido ≥ 80% de las lecciones de la asignatura en el curso lectivo.

## Componentes de calificación por nivel (los que importan para PuraNota)

### Educación diurna académica
| Nivel / asignaturas | Cotidiano | Tareas | Pruebas | Proyecto | Asist. |
|---|---|---|---|---|---|
| **I y II Ciclo** (Mate, E.Soc., Cívica, Ciencias, Español, L.Extr.) — Art. 40a | 50 | 10 | 35 (dos) | — | 5 |
| **III Ciclo** (Mate, Español, E.Soc., Ciencias, L.Extr.) — Art. 41a | 45 | 10 | 40 (dos) | — | 5 |
| **III Ciclo** (Cívica, Artes, Hogar, Ind., Ed.Fís., Música, Psic., Form.Tecn.) — Art. 41b | 45 | 10 | — | 40 | 5 |
| **Diversificada** (Mate, Español, E.Soc., Biol., Fís., Quím., L.Extr.) — Art. 42a | 35 | 10 | 50 (dos) | — | 5 |
| **Diversificada** (Ed.Fís., Música, Artes) — Art. 42b | 45 | 10 | — | 40 | 5 |

### Educación de Personas Jóvenes y Adultas (EPJA) — nocturno / lo que da el usuario

**Colegio Académico Nocturno (rama académica):** usa los **mismos porcentajes** de III Ciclo /
Diversificada académica de arriba (Arts. 41–42, que dicen "diurna y nocturna"). **La diferencia clave
es la PROMOCIÓN: es semestral e independiente por asignatura** (Art. 68). Si repruebas una materia,
solo cursás esa cuando se oferte; las aprobadas se mantienen.

- **Cursos de Desarrollo Humano en Colegios Académicos Nocturnos (Art. 42u):** Cotidiano 40, Tareas 10, Pruebas (≥1) 45, Asist. 5.

**CINDEA / IPEC — Plan de Estudios de Educación de Adultos (Art. 43), oferta convencional:**
| Nivel | Cotidiano | Tareas | Pruebas | Proyecto | Asist. |
|---|---|---|---|---|---|
| I Nivel (excepto módulos opcionales) — 43a | 50 | 10 | 35 (dos) | — | 5 |
| II Nivel (excepto opcionales/cívica) — 43b | 45 | 10 | 40 (dos) | — | 5 |
| II Nivel módulos de Cívica / Form. Tecnológica — 43c | 45 | 10 | — | 40 | 5 |
| III Nivel (excepto opcionales/cívica) — 43d | 40 | 10 | 45 (dos) | — | 5 |
| III Nivel módulo de Cívica — 43e | 35 | 10 | 20 (una) | 30 | 5 |
| Módulos opcionales (cualquier nivel) — 43f | 60 | — | — | 35 | 5 |
| III Nivel — Ética Profesional (obligatorio) — 43h | 45 | 10 | — | 40 | 5 |
| Oferta emergente / cursos libres — 43i | 60 | — | — | 35 | 5 |

**CONED / EPJA a distancia (Art. 45):** ⚠️ **NO lleva componente de asistencia** (es a distancia).
Ej. III Ciclo académicas: Pruebas (tres) 60% + Tareas (tres) 40%. Cívica: Tareas (tres) 60% + Proyecto 40%.
Promoción semestral con normas especiales del CSE (Art. 68).

### Educación Técnica Dual — el usuario tiene grupos dual

La evaluación de las **subáreas de carreras técnicas en modalidad dual (Art. 42v)** es:

| Componente | % |
|---|---|
| Trabajo cotidiano | 25 |
| **Portafolio de evidencias** | 30 |
| Pruebas (mínimo dos) | 40 |
| Asistencia | 5 |

Notas propias de la modalidad dual:
- Usa **Portafolio de evidencias** (no "Tareas"). El **trabajo cotidiano y las evidencias se registran en una BITÁCORA** que el estudiante llena a diario con las actividades en la empresa (Art. ~34); la evalúan **la persona docente en el centro Y la persona mentora en la empresa**.
- **Asistencia (Art. 36):** incluye la **presencia del estudiante en la empresa**; las tardías/ausencias siguen las mismas reglas de justificación; el mentor de la empresa **informa al centro** las incidencias.
- La rama técnica se promueve **anualmente** (Art. 68); si tras ampliación/estrategia se reprueba una subárea, se **repiten todas las subáreas** de la carrera al año siguiente.
- Marco legal aparte: Ley de Educación y Formación Técnica Dual, N° 9728 (la evaluación, sin embargo, se rige por este REAC).

### Otras variantes (referencia rápida, Art. 42)
- Técnicos profesionales nocturnos / secciones técnicas nocturnas / plan 2 años / rama técnica EPJA (Art. 42i): Cotidiano 30, Tareas 10, Pruebas (≥2) 45, Proyecto 10, Asist. 5.
- Liceos bilingües (varias asignaturas, Art. 42j–o): típico Cotidiano 35, Pruebas (≥2) 50, Tareas 10, Asist. 5.
- Plan Tercer Ciclo y Diversificado Vocacional (Art. 44): p.ej. académicas Cotidiano 55, Tareas 20, Prueba (≥1) 20, Asist. 5.
- Religión (todos los niveles): Cotidiano 70, Tareas 25, Asist. 5.

## Conducta (Título aparte) — NO implementado en la app

- Nota mínima para aprobar: **65** (I/II/III Ciclo), **70** (Diversificada) — Arts. 145/146.
- Rebajos por falta: muy leve −5, leve −10, grave −20, muy grave −30, gravísima −50.

## Nota de aprobación y semestralidad
- Aprobación (Art. 47): ≥ 65 (EGB) / ≥ 70 (Diversificada). El que no llega queda **aplazado**.
- Eximir de la última prueba (Art. 49): ≥ 90 en el primer periodo **y** ≥ 90 en cada componente del último periodo.
- EPJA/nocturno/CONED: promoción **semestral e independiente por asignatura** (Art. 68).
