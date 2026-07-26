// Periodos lectivos. Un grupo abarca todo el año y se evalúa por periodos.
// Ver ADR-001 en el README.

// Orden canónico de los periodos posibles.
export const PERIODOS = ['I', 'II', 'III']

// Cantidad de periodos permitida por grupo (configurable: 2 o 3).
export const CANTIDADES_PERIODOS = [2, 3]

const CANTIDAD_POR_DEFECTO = 2

/** Etiqueta legible de un periodo, ej. "I" -> "I Periodo". */
export function etiquetaPeriodo(p) {
  return `${p} Periodo`
}

/**
 * Cantidad de periodos del grupo. Se guarda (por convención) en grupos.periodo
 * como "2" o "3"; cualquier otro valor (formato viejo) cae al por defecto.
 */
export function cantidadPeriodos(grupo) {
  const n = parseInt(grupo?.periodo, 10)
  return CANTIDADES_PERIODOS.includes(n) ? n : CANTIDAD_POR_DEFECTO
}

/** Lista de periodos activos del grupo, ej. ['I','II']. */
export function periodosDeGrupo(grupo) {
  return PERIODOS.slice(0, cantidadPeriodos(grupo))
}

/** true si el periodo pertenece a la cantidad configurada del grupo. */
export function periodoValido(grupo, periodo) {
  return periodosDeGrupo(grupo).includes(periodo)
}

// ─── Calendario del curso lectivo (DATO editable, escalamiento) ───────────────
// Si el MEP mueve el arranque o el cierre del año, se edita SOLO acá; la lógica
// no cambia. Se usa únicamente para SUGERIR las fechas de cada periodo
// (repartiendo el año en partes iguales); el docente siempre puede ajustarlas.
// Si algún año se conocen las fechas oficiales exactas de corte por periodo,
// se pueden agregar en `cortes` por cantidad de periodos y tendrán prioridad.
export const CALENDARIO_LECTIVO = {
  version: '2026',
  inicio: { mes: 2, dia: 1 }, // 1 de febrero
  fin: { mes: 12, dia: 15 }, // 15 de diciembre
  // cortes: { 2: ['06-30'], 3: ['05-15','09-15'] }  // (opcional, a futuro)
}

function ymd(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Sugiere las fechas {I:{inicio,fin},...} repartiendo el año lectivo en partes
 * iguales según la cantidad de periodos. Lee el calendario de `CALENDARIO_LECTIVO`.
 */
export function fechasSugeridasPeriodos(anio, periodos, cal = CALENDARIO_LECTIVO) {
  const y = Number(anio) || new Date().getFullYear()
  const inicio = new Date(y, cal.inicio.mes - 1, cal.inicio.dia)
  const fin = new Date(y, cal.fin.mes - 1, cal.fin.dia)
  const totalMs = fin.getTime() - inicio.getTime()
  const n = periodos.length
  const out = {}
  for (let i = 0; i < n; i++) {
    const s = new Date(inicio.getTime() + (totalMs * i) / n)
    const eRaw = new Date(inicio.getTime() + (totalMs * (i + 1)) / n)
    const e = i < n - 1 ? new Date(eRaw.getTime() - 86400000) : fin
    out[periodos[i]] = { inicio: ymd(s), fin: ymd(e) }
  }
  return out
}
