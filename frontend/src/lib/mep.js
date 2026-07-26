// Normativa del MEP como DATOS versionados y editables.
// Fuente: Reglamento de Evaluación de los Aprendizajes y de la Conducta (REAC),
// decreto 45509-MEP, vigente desde el curso lectivo 2026.
// Ver docs/mep/README.md para las citas de artículo y el texto oficial.
//
// IMPORTANTE (escalamiento): si el reglamento cambia, se editan estos números
// —no la lógica—. Además, el docente SIEMPRE puede sobrescribir los rubros que
// esto pre-llena; el "Modo MEP" es un punto de partida, no un candado.

export const MEP_VERSION = '2026'
export const MEP_DOC_URL = '/reglamento-mep-2026.pdf'

// Art. 54: asistencia mínima para tener derecho a pruebas de ampliación.
export const MIN_ASISTENCIA_AMPLIACION = 0.8

// Art. 47: nota mínima de aprobación (no es 75 como dijo la prensa).
export const UMBRAL = { egb: 65, diversificada: 70 }

// Art. 37: escala de la nota de asistencia según el % de ausencias INJUSTIFICADAS
// sobre el total de lecciones del periodo. Se expresa como nota 0-100 del rubro,
// de modo que para un componente de 5%: 100→5, 80→4, 60→3, 40→2, 20→1, 0→0.
// `hasta` es el límite superior EXCLUSIVO del tramo (fracción 0-1).
export const ESCALA_ASISTENCIA = [
  { hasta: 0.1, nota: 100 },
  { hasta: 0.2, nota: 80 },
  { hasta: 0.3, nota: 60 },
  { hasta: 0.4, nota: 40 },
  { hasta: 0.5, nota: 20 },
  { hasta: Infinity, nota: 0 },
]

// Config estándar del rubro de asistencia del MEP (Arts. 36-37):
// - 5% del periodo.
// - `tardiasPorAusencia: 2` = cada tardía cuenta como media ausencia (el caso
//   <10 min del Art. 37; para tardías ≥10 min el docente puede ponerlo en 1).
// - la justificada nunca baja la nota.
export const ASISTENCIA_MEP = {
  porcentaje: 5,
  tardiasPorAusencia: 2,
  justificadaCuenta: true,
}

// Presets de rubros por modalidad (Arts. 40-45). Cada preset trae los rubros
// normales; la asistencia se agrega aparte (salvo `sinAsistencia`, ej. CONED).
// `umbral` = nota de aprobación de esa modalidad (Art. 47).
export const PRESETS = {
  'academico-i-ii': {
    label: 'Académico · I y II Ciclo (primaria)',
    umbral: UMBRAL.egb,
    rubros: [
      { nombre: 'Trabajo cotidiano', porcentaje: 50 },
      { nombre: 'Tareas', porcentaje: 10 },
      { nombre: 'Pruebas', porcentaje: 35 },
    ],
  },
  'academico-iii': {
    label: 'Académico · III Ciclo (7°-9°, diurno/nocturno)',
    umbral: UMBRAL.egb,
    rubros: [
      { nombre: 'Trabajo cotidiano', porcentaje: 45 },
      { nombre: 'Tareas', porcentaje: 10 },
      { nombre: 'Pruebas', porcentaje: 40 },
    ],
  },
  'academico-diver': {
    label: 'Académico · Diversificada (10°-12°, diurno/nocturno)',
    umbral: UMBRAL.diversificada,
    rubros: [
      { nombre: 'Trabajo cotidiano', porcentaje: 35 },
      { nombre: 'Pruebas', porcentaje: 50 },
      { nombre: 'Tareas', porcentaje: 10 },
    ],
  },
  'tecnico-nocturno': {
    label: 'Técnico Profesional nocturno · subáreas (no dual)',
    umbral: UMBRAL.diversificada,
    rubros: [
      { nombre: 'Trabajo cotidiano', porcentaje: 30 },
      { nombre: 'Tareas', porcentaje: 10 },
      { nombre: 'Pruebas', porcentaje: 45 },
      { nombre: 'Proyecto', porcentaje: 10 },
    ],
  },
  dual: {
    label: 'Técnico · Dual (subáreas técnicas, día o noche)',
    umbral: UMBRAL.diversificada,
    rubros: [
      { nombre: 'Trabajo cotidiano', porcentaje: 25 },
      { nombre: 'Portafolio de evidencias', porcentaje: 30 },
      { nombre: 'Pruebas', porcentaje: 40 },
    ],
  },
  'cindea-i': {
    label: 'CINDEA/IPEC · I Nivel',
    umbral: UMBRAL.egb,
    rubros: [
      { nombre: 'Trabajo cotidiano', porcentaje: 50 },
      { nombre: 'Tareas', porcentaje: 10 },
      { nombre: 'Pruebas', porcentaje: 35 },
    ],
  },
  'cindea-ii': {
    label: 'CINDEA/IPEC · II Nivel',
    umbral: UMBRAL.egb,
    rubros: [
      { nombre: 'Trabajo cotidiano', porcentaje: 45 },
      { nombre: 'Tareas', porcentaje: 10 },
      { nombre: 'Pruebas', porcentaje: 40 },
    ],
  },
  'cindea-iii': {
    label: 'CINDEA/IPEC · III Nivel',
    umbral: UMBRAL.diversificada,
    rubros: [
      { nombre: 'Trabajo cotidiano', porcentaje: 40 },
      { nombre: 'Pruebas', porcentaje: 45 },
      { nombre: 'Tareas', porcentaje: 10 },
    ],
  },
  coned: {
    label: 'CONED / a distancia (III Ciclo, sin asistencia)',
    umbral: UMBRAL.diversificada,
    sinAsistencia: true,
    rubros: [
      { nombre: 'Pruebas', porcentaje: 60 },
      { nombre: 'Tareas', porcentaje: 40 },
    ],
  },
}

/** Lista [{clave, label}] para poblar un selector. */
export function listaPresets() {
  return Object.entries(PRESETS).map(([clave, p]) => ({ clave, label: p.label }))
}

/** Umbral de aprobación (Art. 47) de un preset, o null si no es modalidad MEP. */
export function umbralDeModalidad(clave) {
  return PRESETS[clave]?.umbral ?? null
}

/**
 * Construye los rubros de un preset listos para el editor:
 * { rubros: [{nombre,porcentaje}], asis: {porcentaje,tardiasPorAusencia,justificadaCuenta,mep}|null }.
 * `asis` es null cuando la modalidad no lleva asistencia (CONED).
 */
export function rubrosDeModalidad(clave) {
  const p = PRESETS[clave]
  if (!p) return null
  const rubros = p.rubros.map((r) => ({ ...r }))
  const asis = p.sinAsistencia
    ? null
    : {
        porcentaje: ASISTENCIA_MEP.porcentaje,
        tardiasPorAusencia: ASISTENCIA_MEP.tardiasPorAusencia,
        justificadaCuenta: ASISTENCIA_MEP.justificadaCuenta,
        mep: true,
      }
  return { rubros, asis }
}

/**
 * Rubros COMPLETOS de una modalidad, listos para guardar en grupos.rubros:
 * { I:[...], II:[...], III:[...] }. Cada periodo indicado lleva los rubros del
 * preset + el rubro de asistencia del MEP (salvo modalidades sin asistencia).
 * Sirve para pre-cargar los rubros solos al crear un grupo con Modo MEP.
 */
export function rubrosCompletosDeModalidad(clave, periodos = ['I', 'II', 'III']) {
  const base = rubrosDeModalidad(clave)
  if (!base) return null
  const arr = base.rubros.map((r) => ({ ...r }))
  if (base.asis) {
    arr.push({
      nombre: 'Asistencia',
      porcentaje: base.asis.porcentaje,
      asistencia: true,
      mep: true,
      tardiasPorAusencia: base.asis.tardiasPorAusencia,
      justificadaCuenta: base.asis.justificadaCuenta,
    })
  }
  const out = { I: [], II: [], III: [] }
  for (const p of periodos) {
    if (out[p] !== undefined) out[p] = arr.map((r) => ({ ...r }))
  }
  return out
}

/**
 * Nota 0-100 del rubro de asistencia según la escala escalonada del MEP (Art. 37).
 * Recibe la FRACCIÓN de ausencias injustificadas sobre el total de lecciones.
 */
export function notaAsistenciaMEP(fraccionAusencias) {
  const f = Math.max(0, Number(fraccionAusencias) || 0)
  for (const tramo of ESCALA_ASISTENCIA) {
    if (f < tramo.hasta) return tramo.nota
  }
  return 0
}
