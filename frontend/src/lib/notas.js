// Cálculo de notas por periodo (ver ADR-001).
//
// Definición usada (documentada para poder cambiarla en un solo lugar):
// - nota_rubro = promedio de (nota/puntos*100) sobre las asignaciones de ese
//   rubro que el estudiante tiene CALIFICADAS. Si no tiene ninguna calificada
//   en el rubro, queda en null (—) y no pesa en el promedio.
// - promedio del periodo = promedio ponderado de los rubros con nota, usando
//   sus porcentajes (se renormaliza entre los rubros ya calificados, así el
//   número es un "avance" sobre 100 y no castiga lo que aún no se califica).

import { notaAsistenciaMEP } from './mep'

/**
 * @param rubros [{nombre, porcentaje, asistencia?, tardiasPorAusencia?, justificadaCuenta?}]
 * @param asignaciones [{id, rubro, puntos}] del periodo
 * @param entregaDeAsignacion (asignacionId) => entrega|null  (con {estado, nota})
 * @param asistenciaConteos {presente,ausente,tardia,justificada} del periodo (o null)
 * @returns { porRubro: [{nombre, porcentaje, nota, puntos, calificadas, total, esAsistencia}], lleva }
 *   `puntos` = puntos que el rubro aporta al 100 (nota×%/100); `lleva` = suma acumulada.
 */
export function calcularNotasPeriodo(
  rubros,
  asignaciones,
  entregaDeAsignacion,
  asistenciaConteos = null,
) {
  const porRubro = (rubros || []).map((r) => {
    const porcentajeRubro = Number(r.porcentaje) || 0
    // Rubro de asistencia: su nota la calcula el registro de asistencia, no las
    // asignaciones. Se reconoce por el flag `asistencia:true` o por el nombre.
    const esAsistencia =
      r.asistencia === true ||
      (r.nombre || '').trim().toLowerCase() === 'asistencia'

    if (esAsistencia) {
      const nota = asistenciaConteos ? notaAsistencia(asistenciaConteos, r) : null
      return {
        nombre: r.nombre || 'Asistencia',
        porcentaje: porcentajeRubro,
        nota,
        promedio: nota, // el promedio del rubro de asistencia ES su nota (0-100)
        puntos: nota == null ? null : (nota * porcentajeRubro) / 100,
        pesoCalificado: nota == null ? 0 : porcentajeRubro,
        calificadas: nota == null ? 0 : 1,
        total: 1,
        esAsistencia: true,
      }
    }

    // Cada asignación aporta (nota÷puntos) × su % al periodo. La nota del rubro
    // es la SUMA de esos aportes (ej. dos tareas de 5% al 80% y 90% → 8.5/10%).
    const asigs = asignaciones.filter((a) => (a.rubro || '') === r.nombre)
    let aporte = 0
    let calificadas = 0
    let pesoCalificado = 0 // suma de % de las asignaciones YA calificadas del rubro
    for (const a of asigs) {
      const e = entregaDeAsignacion(a.id)
      if (e && e.estado === 'calificada' && e.nota != null && Number(a.puntos) > 0) {
        let frac = Number(e.nota) / Number(a.puntos)
        // Entrega tardía: se descuenta el % de penalización PROPIO de la asignación
        // (no de la nota guardada, así es reversible). Ver ADR/penalización por tarea.
        const penA =
          Math.max(0, Math.min(100, Number(a.penalizacion_tardia) || 0)) / 100
        if (e.tardia && penA > 0) frac *= 1 - penA
        aporte += frac * (Number(a.porcentaje) || 0)
        pesoCalificado += Number(a.porcentaje) || 0
        calificadas++
      }
    }
    const puntos = calificadas ? aporte : null
    // PROMEDIO del rubro (0-100) SOBRE LO YA CALIFICADO: es lo intuitivo para el
    // estudiante ("¿qué nota llevo?"), no lo baja lo que aún no se califica.
    const promedio = pesoCalificado > 0 ? (aporte / pesoCalificado) * 100 : null
    // Nota "acumulada" del rubro (sobre su peso completo), por si se necesita.
    const nota = puntos != null && porcentajeRubro > 0 ? (puntos / porcentajeRubro) * 100 : null
    return {
      nombre: r.nombre,
      porcentaje: porcentajeRubro,
      nota,
      promedio,
      puntos,
      pesoCalificado,
      calificadas,
      total: asigs.length,
      esAsistencia: false,
    }
  })

  // Acumulado del periodo (suma de aportes de lo calificado, sobre 100) y
  // PROMEDIO sobre lo calificado (renormalizado) — este último es el que se le
  // muestra al estudiante por ser el más fácil de entender.
  let lleva = 0
  let pesoTot = 0
  let hayAlgo = false
  for (const r of porRubro) {
    if (r.puntos != null) {
      lleva += r.puntos
      pesoTot += r.pesoCalificado
      hayAlgo = true
    }
  }
  const promedio = pesoTot > 0 ? (lleva / pesoTot) * 100 : null

  return { porRubro, lleva: hayAlgo ? lleva : null, promedio }
}

/**
 * Asignaciones "huérfanas": apuntan (por nombre) a un rubro que ya no existe en
 * la lista del periodo, así que sus notas NO entran en el total. Conviene
 * avisarlo en vez de perderlas en silencio (pasa si se borró/renombró el rubro).
 * Devuelve las asignaciones huérfanas tal cual.
 */
export function asignacionesHuerfanas(rubros, asignaciones) {
  const nombres = new Set(
    (rubros || []).map((r) => (r.nombre || '').trim()).filter(Boolean),
  )
  return (asignaciones || []).filter((a) => !nombres.has((a.rubro || '').trim()))
}

/** Redondea a `dec` decimales o devuelve null. */
export function redondear(n, dec = 1) {
  if (n == null) return null
  const f = 10 ** dec
  return Math.round(n * f) / f
}

/**
 * % de asistencia = días NO ausentes / días registrados.
 * Recibe un objeto de conteos {presente, ausente, tardia, justificada}.
 */
export function porcentajeAsistencia(conteos) {
  const total =
    (conteos.presente || 0) +
    (conteos.ausente || 0) +
    (conteos.tardia || 0) +
    (conteos.justificada || 0)
  if (total === 0) return null
  const noAusentes = total - (conteos.ausente || 0)
  return (noAusentes / total) * 100
}

/**
 * Cuenta los registros de asistencia dentro de un rango de fechas (o todos si no
 * hay rango). `rows` = [{fecha:'YYYY-MM-DD', estado}]; `rango` = {inicio, fin}|null.
 */
export function contarAsistencia(rows, rango) {
  const c = { presente: 0, ausente: 0, tardia: 0, justificada: 0 }
  for (const r of rows || []) {
    if (rango?.inicio && r.fecha < rango.inicio) continue
    if (rango?.fin && r.fecha > rango.fin) continue
    if (c[r.estado] != null) c[r.estado]++
  }
  return c
}

/**
 * Nota de asistencia (0-100) según la regla configurable del rubro:
 * - `tardiasPorAusencia` (ej. 2 → "2 tardías = 1 ausencia").
 * - `justificadaCuenta` (si false, la justificada también cuenta como ausencia).
 * - `mep` (si true, aplica la escala escalonada del MEP, Art. 37, en vez del
 *   cálculo lineal: la nota salta por tramos de % de ausencias injustificadas).
 * Devuelve null si no hay días registrados.
 */
export function notaAsistencia(
  conteos,
  { tardiasPorAusencia = 2, justificadaCuenta = true, mep = false } = {},
) {
  const presente = conteos.presente || 0
  const ausente = conteos.ausente || 0
  const tardia = conteos.tardia || 0
  const justificada = conteos.justificada || 0
  const total = presente + ausente + tardia + justificada
  if (total === 0) return null

  const por = Number(tardiasPorAusencia) > 0 ? Number(tardiasPorAusencia) : 2
  let ausencias = ausente + tardia / por
  if (!justificadaCuenta) ausencias += justificada

  if (mep) {
    // Escala oficial del MEP (Art. 37): la nota depende del TRAMO de % de
    // ausencias injustificadas sobre el total de lecciones, no es lineal.
    return notaAsistenciaMEP(ausencias / total)
  }

  const pct = ((total - ausencias) / total) * 100
  return Math.max(0, Math.min(100, pct))
}
