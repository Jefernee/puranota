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
      return { clave: 'calificada', etiqueta: 'Calificada', tono: 'pizarra' }
    return { clave: 'sin_nota', etiqueta: 'Pendiente de nota', tono: 'tinta' }
  }

  if (entrega) {
    if (entrega.estado === 'calificada')
      return { clave: 'calificada', etiqueta: 'Calificada', tono: 'pizarra' }
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

// ─── Tipo de actividad (columna "Tipo" del registro) ─────────────────────────

/**
 * Tipos de actividad. El ícono es discreto a propósito: identifica de un vistazo
 * sin competir con el texto (ver docs/PLAN.md §3.3).
 */
// Solo el nombre legible. El aspecto (ícono y color) vive en
// components/IconoTipo.jsx, para que un glifo suelto no se desalinee.
export const TIPOS = {
  entrega: { label: 'Entrega' },
  prueba: { label: 'Prueba' },
  proyecto: { label: 'Proyecto' },
  foro: { label: 'Foro' },
}


/**
 * Tipo de una asignación. Las filas viejas (anteriores a la columna `tipo`) se
 * deducen de `requiere_entrega`, así nada se ve roto mientras se migran.
 */
export function tipoDe(asignacion) {
  const t = asignacion?.tipo
  if (t && TIPOS[t]) return { clave: t, ...TIPOS[t] }
  const clave = asignacion?.requiere_entrega === false ? 'prueba' : 'entrega'
  return { clave, ...TIPOS[clave] }
}

/**
 * Estado para la columna "Estado" del registro. A diferencia de `calcularEstado`,
 * acá "calificada" NO es un estado: la calificación tiene su propia columna. Lo
 * que importa es si entregó y si lo hizo a tiempo.
 */
export function estadoRegistro(asignacion, entrega) {
  if (asignacion?.requiere_entrega === false) {
    return { clave: 'sin_entrega', etiqueta: 'No requiere entrega', tono: 'tinta' }
  }
  if (entrega) {
    return entrega.tardia
      ? { clave: 'tardia', etiqueta: 'Entregada tarde', tono: 'margen' }
      : { clave: 'entregada', etiqueta: 'Entregada', tono: 'pizarra' }
  }
  const { vencido } = vencimiento(asignacion)
  if (vencido && !asignacion?.permite_tardias)
    return { clave: 'cerrada', etiqueta: 'Cerrada', tono: 'tinta' }
  return { clave: 'sin_entregar', etiqueta: 'Sin entregar', tono: 'tinta' }
}

// Clases de color para los badges de estado, por tono del tema. Con aro interno
// para que se lean como pastillas definidas (y no "lavadas") en claro y oscuro.
export const TONO_BADGE = {
  pizarra: 'bg-pizarra/15 text-pizarra ring-1 ring-inset ring-pizarra/30',
  guaria: 'bg-guaria/15 text-guaria ring-1 ring-inset ring-guaria/30',
  margen: 'bg-margen/15 text-margen ring-1 ring-inset ring-margen/30',
  tinta: 'bg-tinta/10 text-tinta/70 ring-1 ring-inset ring-tinta/20',
}
