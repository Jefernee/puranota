// Cálculo de notas — MODELO DE REGISTRO (ver docs/PLAN.md §3).
//
// VOCABULARIO. Tres palabras, las mismas acá, en la pantalla del docente y en la
// del estudiante. Si alguna vez hay que cambiar algo, se cambia SOLO en este
// archivo.
//
//   Valor %       = asignaciones.porcentaje — cuánto vale la actividad del periodo.
//   Calificación  = (nota / puntos) × Valor % — cuánto de ese valor obtuvo,
//                   expresado EN PORCENTAJE, nunca en puntos crudos.
//   NOTA FINAL    = suma de la columna Calificación.
//   Evaluado      = suma de los Valor % de lo que ya se calificó.
//
// Regla de oro: la NOTA FINAL es la suma de lo que se ve en pantalla. Si una
// fila no cuenta (rubro inexistente o sin Valor %), su celda muestra un aviso,
// NO un número — así la suma siempre cuadra y el docente puede verificarla de
// cabeza.
//
// Decimales: REAC 2026 Art. 26 → dos decimales en las notas de periodo.

import { notaAsistenciaMEP } from './mep'

/** Decimales de las notas de periodo (REAC Art. 26). */
export const DECIMALES = 2

/** Redondea a `dec` decimales, o devuelve null. */
export function redondear(n, dec = DECIMALES) {
  if (n == null || Number.isNaN(n)) return null
  const f = 10 ** dec
  return Math.round(n * f) / f
}

/**
 * Formatea un porcentaje al estilo de Costa Rica. Es la ÚNICA forma en que se
 * escriben porcentajes en la interfaz. Devuelve "—" si no hay valor.
 *
 * NO muestra decimales cuando no los hay: un registro lleno de "5,00%" y
 * "8,00%" se lee peor y no aporta nada. Los decimales aparecen solo cuando
 * existen de verdad.
 *
 *    5     → "5%"
 *    8     → "8%"
 *    31.5  → "31,5%"
 *    31.47 → "31,47%"
 *
 * La precisión no se pierde: se redondea a 2 decimales (REAC Art. 26), solo se
 * omiten los ceros de relleno. Para el registro oficial, donde el reglamento
 * pide los dos decimales escritos, se usa `pctFijo`.
 */
export function pct(n, dec = DECIMALES) {
  if (n == null || Number.isNaN(n)) return '—'
  return (
    Number(n).toLocaleString('es-CR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: dec,
    }) + '%'
  )
}

/** Porcentaje con los dos decimales SIEMPRE escritos ("5,00%"), para el
 *  registro oficial y las exportaciones (REAC Art. 26). */
export function pctFijo(n, dec = DECIMALES) {
  if (n == null || Number.isNaN(n)) return '—'
  return (
    Number(n).toLocaleString('es-CR', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }) + '%'
  )
}

/**
 * Redondeo del promedio ponderado ANUAL (REAC Art. 26): decimales ≥ 0,50 suben
 * al entero superior; menores bajan. Solo se usa para el promedio del año, no
 * para las notas de periodo.
 */
export function redondearAnual(n) {
  if (n == null || Number.isNaN(n)) return null
  return Math.floor(n + 0.5)
}

/**
 * ¿Cómo va el estudiante contra el mínimo de aprobación? Devuelve
 * 'aprobado' | 'perdido' | 'en_juego' | null (si no hay umbral o no hay nota).
 *
 * Existe para que el color no mienta. Antes se pintaba de rojo toda nota por
 * debajo del mínimo, y a mitad de periodo eso es falso: con un 55% evaluado
 * nadie llega a 65 todavía, así que el grupo entero se veía reprobando.
 *
 *   aprobado = ya alcanzó el mínimo, y como la nota solo sube, no lo pierde
 *   perdido  = ni sacando todo lo que falta llega
 *   en_juego = todavía se define
 */
export function estadoAprobacion(notaFinal, evaluado, umbral) {
  if (umbral == null || notaFinal == null) return null
  if (notaFinal >= umbral) return 'aprobado'
  const porEvaluar = Math.max(0, 100 - (Number(evaluado) || 0))
  return notaFinal + porEvaluar < umbral ? 'perdido' : 'en_juego'
}

/** ¿Este rubro es el de asistencia (se calcula solo)? */
export function esRubroAsistencia(r) {
  return (
    r?.asistencia === true ||
    (r?.nombre || '').trim().toLowerCase() === 'asistencia'
  )
}

/**
 * CALIFICACIÓN de una actividad, en porcentaje del periodo.
 * Devuelve null si todavía no está calificada o si le falta un dato para poder
 * calcularla.
 */
export function calificacionDe(asignacion, entrega) {
  if (!entrega || entrega.estado !== 'calificada' || entrega.nota == null) return null

  const puntos = Number(asignacion?.puntos)
  const valor = Number(asignacion?.porcentaje)
  if (!(puntos > 0) || !(valor > 0)) return null

  let fraccion = Number(entrega.nota) / puntos

  // La penalización por tardía SOLO aplica cuando el estudiante realmente tenía
  // que entregar algo. En una prueba escrita la fila de entrega la crea el
  // docente al calificar, y el trigger de la base la marcaría "tardía" sin que
  // el estudiante haya hecho nada mal (ver CLAUDE.md §7.6 A).
  const seEntrega = asignacion?.requiere_entrega !== false
  const penalizacion =
    Math.max(0, Math.min(100, Number(asignacion?.penalizacion_tardia) || 0)) / 100
  if (seEntrega && entrega.tardia && penalizacion > 0) {
    fraccion *= 1 - penalizacion
  }

  return fraccion * valor
}

/** Motivo por el que una actividad no puede contar para la nota, o null. */
export function motivoNoCuenta(asignacion, nombresDeRubro) {
  const rubro = (asignacion?.rubro || '').trim()
  if (!nombresDeRubro.has(rubro)) return 'rubro'
  if (!(Number(asignacion?.porcentaje) > 0)) return 'sin_valor'
  return null
}

/**
 * REGISTRO de calificaciones de un estudiante en un periodo.
 *
 * @param rubros        [{nombre, porcentaje, asistencia?, tardiasPorAusencia?, justificadaCuenta?, mep?}]
 * @param asignaciones  las del periodo, [{id, titulo, tipo, rubro, puntos, porcentaje, ...}]
 * @param entregaDe     (asignacionId) => entrega | null
 * @param conteos       {presente, ausente, tardia, justificada} del periodo, o null
 *
 * @returns {
 *   filas:      [{ asignacion, entrega, valor, calificacion, noCuenta }],
 *   asistencia: { valor, calificacion, conteos, regla } | null,
 *   notaFinal:  number | null,   // suma de la columna Calificación
 *   evaluado:   number,          // suma de los Valor % ya calificados
 *   porRubro:   [{ nombre, valor, obtenido, esAsistencia }],
 *   avisos:     { rubro: [asignacion], sinValor: [asignacion] }
 * }
 */
export function calcularRegistro(rubros, asignaciones, entregaDe, conteos = null) {
  const lista = rubros || []
  const normales = lista.filter((r) => !esRubroAsistencia(r))
  const rubroAsistencia = lista.find(esRubroAsistencia) || null

  const nombres = new Set(normales.map((r) => (r.nombre || '').trim()).filter(Boolean))

  const filas = []
  const avisos = { rubro: [], sinValor: [] }

  for (const a of asignaciones || []) {
    const entrega = entregaDe(a.id) || null
    const noCuenta = motivoNoCuenta(a, nombres)

    if (noCuenta === 'rubro') avisos.rubro.push(a)
    if (noCuenta === 'sin_valor') avisos.sinValor.push(a)

    filas.push({
      asignacion: a,
      entrega,
      valor: Number(a.porcentaje) > 0 ? Number(a.porcentaje) : null,
      // Si no cuenta, no se muestra número: se muestra el aviso. Así la suma de
      // la columna siempre da la NOTA FINAL.
      calificacion: noCuenta ? null : calificacionDe(a, entrega),
      noCuenta,
    })
  }

  // Fila de asistencia: no es una actividad, su calificación sale del registro
  // de asistencia. Se muestra como una fila más del registro.
  let asistencia = null
  if (rubroAsistencia) {
    const valor = Number(rubroAsistencia.porcentaje) || 0
    const logro = conteos ? notaAsistencia(conteos, rubroAsistencia) : null
    asistencia = {
      valor: valor > 0 ? valor : null,
      calificacion: logro == null || valor <= 0 ? null : (logro * valor) / 100,
      logro,
      conteos,
      regla: rubroAsistencia,
    }
  }

  // NOTA FINAL = suma de la columna Calificación. Evaluado = suma de los Valor %
  // de las filas que ya tienen calificación.
  let notaFinal = 0
  let evaluado = 0
  let hayAlgo = false
  for (const f of filas) {
    if (f.calificacion != null) {
      notaFinal += f.calificacion
      evaluado += f.valor || 0
      hayAlgo = true
    }
  }
  if (asistencia?.calificacion != null) {
    notaFinal += asistencia.calificacion
    evaluado += asistencia.valor || 0
    hayAlgo = true
  }

  // Subtotal por rubro. Es lo que se muestra como columna en el registro del
  // docente: "Trabajo cotidiano 21,78%", no una columna por cada actividad.
  //
  // Van también los conteos, porque `obtenido: 0` es ambiguo: puede ser que el
  // estudiante sacara cero, o que todavía no le hayan calificado nada. Sin
  // distinguirlos, la pantalla mostraría un 0% donde corresponde una raya.
  const porRubro = normales.map((r) => {
    const nombre = (r.nombre || '').trim()
    const suyas = filas.filter(
      (f) => !f.noCuenta && (f.asignacion.rubro || '').trim() === nombre,
    )
    const conNota = suyas.filter((f) => f.calificacion != null)
    return {
      nombre: r.nombre,
      valor: Number(r.porcentaje) || 0,
      obtenido: conNota.reduce((s, f) => s + f.calificacion, 0),
      calificadas: conNota.length,
      total: suyas.length,
      esAsistencia: false,
    }
  })
  if (rubroAsistencia) {
    porRubro.push({
      nombre: rubroAsistencia.nombre || 'Asistencia',
      valor: Number(rubroAsistencia.porcentaje) || 0,
      obtenido: asistencia?.calificacion || 0,
      calificadas: asistencia?.calificacion != null ? 1 : 0,
      total: 1,
      esAsistencia: true,
    })
  }

  return {
    filas,
    asistencia,
    notaFinal: hayAlgo ? notaFinal : null,
    evaluado,
    porRubro,
    avisos,
  }
}

// ─── Asistencia ───────────────────────────────────────────────────────────────

/**
 * Cuántas lecciones vale cada día de la semana.
 *
 * El MEP cuenta la asistencia POR LECCIÓN, no por día (Art. 37: «el número
 * total de lecciones impartidas»). Si el grupo tiene bloques desiguales —lunes
 * 2 lecciones y miércoles 4— faltar un miércoles pesa el doble.
 *
 * `leccionesPorDia` es {"1":2,"3":4} con 1=lunes … 5=viernes. Vacío = cada día
 * pesa 1, que es como funcionaba antes de existir esta configuración.
 *
 * Devuelve una función `(fecha) => número` para no rehacer el trabajo por fila.
 */
export function pesoDeLeccion(leccionesPorDia) {
  const mapa =
    leccionesPorDia && typeof leccionesPorDia === 'object' ? leccionesPorDia : {}
  if (Object.keys(mapa).length === 0) return () => 1

  return (fecha) => {
    const [y, m, d] = String(fecha || '')
      .slice(0, 10)
      .split('-')
      .map(Number)
    // Se arma la fecha a mano: `new Date('2026-07-27')` la lee como UTC y en
    // Costa Rica devolvería el día anterior.
    if (!y || !m || !d) return 1
    const n = Number(mapa[String(new Date(y, m - 1, d).getDay())])
    // Un día no configurado igual cuenta: mejor pesar 1 que perder el registro.
    return n > 0 ? n : 1
  }
}

/**
 * Cuenta la asistencia dentro de un rango de fechas (o toda, si no hay rango).
 *
 * `rows` = [{fecha:'YYYY-MM-DD', estado, lecciones_perdidas?}]
 * `peso`  = función de `pesoDeLeccion`; por omisión cada día vale 1.
 *
 * Los conteos que devuelve son de LECCIONES, no de días.
 *
 * La **fuga** se reparte: el estudiante estuvo en la clase y se fue antes, así
 * que las lecciones que perdió son ausencias injustificadas (Art. 37) y las que
 * sí estuvo cuentan como presente. Aparte es falta leve de conducta (Art. 154
 * inciso d), pero eso no lo lleva PuraNota.
 */
export function contarAsistencia(rows, rango, peso = () => 1) {
  const c = { presente: 0, ausente: 0, tardia: 0, justificada: 0 }
  for (const r of rows || []) {
    if (rango?.inicio && r.fecha < rango.inicio) continue
    if (rango?.fin && r.fecha > rango.fin) continue

    const lecciones = Math.max(1, Number(peso(r.fecha)) || 1)

    if (r.estado === 'fuga') {
      // Sin dato, se asume que se fue en la última lección.
      const perdidas = Math.min(
        lecciones,
        Math.max(1, Number(r.lecciones_perdidas) || 1),
      )
      c.ausente += perdidas
      c.presente += lecciones - perdidas
      continue
    }

    if (c[r.estado] != null) c[r.estado] += lecciones
  }
  return c
}

/** Total de lecciones registradas en un conteo. */
export function diasRegistrados(conteos) {
  if (!conteos) return 0
  return (
    (conteos.presente || 0) +
    (conteos.ausente || 0) +
    (conteos.tardia || 0) +
    (conteos.justificada || 0)
  )
}

/**
 * LOGRO de asistencia (0-100) según la regla configurable del rubro:
 * - `tardiasPorAusencia` (ej. 2 → "2 tardías = 1 ausencia").
 * - `justificadaCuenta` (si es false, la justificada también resta).
 * - `mep` (si es true, aplica la escala escalonada del Art. 37 en vez del
 *   cálculo lineal).
 * Devuelve null si no hay días registrados.
 */
export function notaAsistencia(
  conteos,
  { tardiasPorAusencia = 2, justificadaCuenta = true, mep = false } = {},
) {
  const total = diasRegistrados(conteos)
  if (total === 0) return null

  const por = Number(tardiasPorAusencia) > 0 ? Number(tardiasPorAusencia) : 2
  let ausencias = (conteos.ausente || 0) + (conteos.tardia || 0) / por
  if (!justificadaCuenta) ausencias += conteos.justificada || 0

  if (mep) return notaAsistenciaMEP(ausencias / total)

  const p = ((total - ausencias) / total) * 100
  return Math.max(0, Math.min(100, p))
}

/**
 * % de asistencia "crudo" de referencia: días no ausentes / días registrados.
 * No aplica la regla del rubro; sirve solo para mostrarlo como dato.
 */
export function porcentajeAsistencia(conteos) {
  const total = diasRegistrados(conteos)
  if (total === 0) return null
  return ((total - (conteos.ausente || 0)) / total) * 100
}

/**
 * % de presencia para la regla del 80% de pruebas de ampliación (REAC Art. 54):
 * días en que asistió (presente o tardía) sobre el total registrado.
 */
export function porcentajePresencia(conteos) {
  const total = diasRegistrados(conteos)
  if (total === 0) return null
  return (((conteos.presente || 0) + (conteos.tardia || 0)) / total) * 100
}
