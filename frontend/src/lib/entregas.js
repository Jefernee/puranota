// Lógica de estado de una entrega desde la vista del estudiante.
// Refleja las reglas RLS de la base (no las reemplaza, solo guía la interfaz).

function vencimiento(asignacion) {
  const limite = asignacion?.fecha_limite
    ? new Date(asignacion.fecha_limite).getTime()
    : null
  return { limite, vencido: limite != null && Date.now() > limite }
}

/**
 * Estado a mostrar para (asignacion, entrega|null).
 * Devuelve { clave, etiqueta, tono } donde tono es un color del tema.
 */
export function calcularEstado(asignacion, entrega) {
  // Prueba escrita / nota directa: el estudiante no entrega nada, así que no
  // aplica "entregada"/"tardía"; solo importa si ya tiene nota.
  if (asignacion?.requiere_entrega === false) {
    if (entrega?.estado === 'calificada')
      return { clave: 'calificada', etiqueta: 'Calificada', tono: 'guaria' }
    return { clave: 'sin_nota', etiqueta: 'Pendiente de nota', tono: 'tinta' }
  }

  if (entrega) {
    if (entrega.estado === 'calificada')
      return { clave: 'calificada', etiqueta: 'Calificada', tono: 'guaria' }
    if (entrega.tardia)
      return { clave: 'tardia', etiqueta: 'Entregada tarde', tono: 'margen' }
    return { clave: 'entregada', etiqueta: 'Entregada', tono: 'pizarra' }
  }
  const { vencido } = vencimiento(asignacion)
  if (vencido && !asignacion.permite_tardias)
    return { clave: 'cerrada', etiqueta: 'Cerrada', tono: 'tinta' }
  if (vencido)
    return { clave: 'pendiente_tardia', etiqueta: 'Pendiente · tardía', tono: 'margen' }
  return { clave: 'pendiente', etiqueta: 'Pendiente', tono: 'margen' }
}

/**
 * ¿Puede el estudiante entregar o reemplazar ahora?
 * - Sin entrega: puede crear si la asignación admite tardías o no venció.
 * - Con entrega: solo reemplaza si está 'entregada' (no calificada) y antes
 *   de la fecha límite (igual que la política RLS de reemplazo).
 */
export function puedeEntregar(asignacion, entrega) {
  // Prueba escrita: el estudiante no entrega (la nota la pone el docente).
  if (asignacion?.requiere_entrega === false) return false
  const { limite, vencido } = vencimiento(asignacion)
  if (entrega) {
    return entrega.estado === 'entregada' && (limite == null || !vencido)
  }
  return asignacion.permite_tardias || limite == null || !vencido
}

// Clases de color para los badges de estado, por tono del tema. Con aro interno
// para que se lean como pastillas definidas (y no "lavadas") en claro y oscuro.
export const TONO_BADGE = {
  pizarra: 'bg-pizarra/15 text-pizarra ring-1 ring-inset ring-pizarra/30',
  guaria: 'bg-guaria/15 text-guaria ring-1 ring-inset ring-guaria/30',
  margen: 'bg-margen/15 text-margen ring-1 ring-inset ring-margen/30',
  tinta: 'bg-tinta/10 text-tinta/70 ring-1 ring-inset ring-tinta/20',
}
