// Utilidades de formato en español de Costa Rica.

/** Fecha (y hora opcional) legible, ej. "14 jun 2026, 03:00 p. m.". */
export function formatearFecha(iso, conHora = true) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

/**
 * Texto relativo de vencimiento, ej. "Vence hoy", "Vence en 3 días",
 * "Venció hace 2 días". Devuelve '' si no hay fecha.
 */
export function textoVencimiento(iso) {
  if (!iso) return ''
  const limite = new Date(iso)
  if (Number.isNaN(limite.getTime())) return ''
  const hoy = new Date()
  // Diferencia en días calendario.
  const msPorDia = 24 * 60 * 60 * 1000
  const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const b = new Date(limite.getFullYear(), limite.getMonth(), limite.getDate())
  const dias = Math.round((b - a) / msPorDia)

  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  if (dias > 1) return `Vence en ${dias} días`
  if (dias === -1) return 'Venció ayer'
  return `Venció hace ${Math.abs(dias)} días`
}
