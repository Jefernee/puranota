import { supabase } from '../lib/supabase'

// Capa de servicios para las asignaciones (tareas/cotidianos) de un grupo.
// RLS ya garantiza que el docente solo toca las asignaciones de sus grupos.

/**
 * Lista las asignaciones de un grupo, más recientes primero.
 * Si se pasa `periodo` ('I'|'II'|'III'), filtra solo las de ese periodo.
 */
export async function listarAsignaciones(grupoId, periodo) {
  let q = supabase.from('asignaciones').select('*').eq('grupo_id', grupoId)
  if (periodo) q = q.eq('periodo', periodo)
  const { data, error } = await q.order('creado_en', { ascending: false })
  if (error) throw error
  return data
}

/**
 * Lista las asignaciones visibles de varios grupos (vista estudiante).
 * RLS ya limita a las visibles de grupos donde el estudiante es miembro.
 * Trae el nombre del grupo para mostrarlo en el dashboard.
 */
export async function listarAsignacionesDeGrupos(grupoIds) {
  if (!grupoIds?.length) return []
  const { data, error } = await supabase
    .from('asignaciones')
    .select('*, grupo:grupos(id, nombre)')
    .in('grupo_id', grupoIds)
    .order('fecha_limite', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

/** Obtiene una asignación por id, con la clase vinculada (si tiene). */
export async function obtenerAsignacion(asignacionId) {
  const { data, error } = await supabase
    .from('asignaciones')
    .select('*, clase:clases(id, titulo)')
    .eq('id', asignacionId)
    .single()
  if (error) throw error
  return data
}

/** Crea una asignación en el grupo. */
export async function crearAsignacion(grupoId, datos) {
  const { data, error } = await supabase
    .from('asignaciones')
    .insert({ ...limpiarDatos(datos), grupo_id: grupoId })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Actualiza una asignación. */
export async function actualizarAsignacion(asignacionId, datos) {
  const { data, error } = await supabase
    .from('asignaciones')
    .update(limpiarDatos(datos))
    .eq('id', asignacionId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Cambia solo la visibilidad (mostrar/ocultar a estudiantes). */
export async function cambiarVisibilidad(asignacionId, visible) {
  const { data, error } = await supabase
    .from('asignaciones')
    .update({ visible: !!visible })
    .eq('id', asignacionId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Borra una asignación (arrastra entregas y archivos por cascada en la base). */
export async function eliminarAsignacion(asignacionId) {
  const { error } = await supabase
    .from('asignaciones')
    .delete()
    .eq('id', asignacionId)
  if (error) throw error
}

/**
 * Resume las asignaciones de un grupo agrupadas por periodo y rubro.
 * Devuelve { [periodo]: { [rubro]: { count, pct } } }, donde `pct` es la suma de
 * los porcentajes de las asignaciones de ese rubro (cuánto del presupuesto del
 * rubro está realmente repartido). Lo usa el editor de rubros para avisar antes
 * de quitar/renombrar y para mostrar el reparto (las asignaciones se vinculan a
 * su rubro por NOMBRE).
 */
export async function resumenAsignacionesPorRubro(grupoId) {
  const { data, error } = await supabase
    .from('asignaciones')
    .select('periodo, rubro, porcentaje')
    .eq('grupo_id', grupoId)
  if (error) throw error
  const out = {}
  for (const a of data || []) {
    const p = a.periodo || 'I'
    const r = (a.rubro || '').trim()
    if (!r) continue
    out[p] = out[p] || {}
    out[p][r] = out[p][r] || { count: 0, pct: 0 }
    out[p][r].count += 1
    out[p][r].pct += Number(a.porcentaje) || 0
  }
  return out
}

/**
 * Renombra un rubro en TODAS las asignaciones de un grupo+periodo (cascada al
 * renombrar el rubro en el editor). Sin esto, renombrar un rubro desconectaría
 * sus asignaciones y sus notas dejarían de contar en silencio.
 * Devuelve la cantidad de asignaciones actualizadas.
 */
export async function renombrarRubroEnAsignaciones(grupoId, periodo, de, a) {
  const desde = (de || '').trim()
  const hacia = (a || '').trim()
  if (!desde || !hacia || desde === hacia) return 0
  const { data, error } = await supabase
    .from('asignaciones')
    .update({ rubro: hacia })
    .eq('grupo_id', grupoId)
    .eq('periodo', periodo)
    .eq('rubro', desde)
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

// ---------------- Helpers ----------------

// Solo deja pasar columnas que el formulario maneja y normaliza tipos.
function limpiarDatos(d) {
  const out = {}
  if (d.titulo !== undefined) out.titulo = d.titulo.trim()
  if (d.periodo !== undefined) out.periodo = d.periodo || 'I'
  if (d.instrucciones !== undefined)
    out.instrucciones = d.instrucciones?.trim() || null
  if (d.rubro !== undefined) out.rubro = d.rubro?.trim() || 'Trabajo cotidiano'
  if (d.puntos !== undefined) out.puntos = Number(d.puntos)
  if (d.porcentaje !== undefined)
    out.porcentaje =
      d.porcentaje === '' || d.porcentaje == null ? null : Number(d.porcentaje)
  if (d.fecha_limite !== undefined)
    out.fecha_limite = d.fecha_limite ? new Date(d.fecha_limite).toISOString() : null
  if (d.permite_tardias !== undefined)
    out.permite_tardias = !!d.permite_tardias
  if (d.penalizacion_tardia !== undefined)
    out.penalizacion_tardia = Math.max(
      0,
      Math.min(100, Number(d.penalizacion_tardia) || 0),
    )
  if (d.requiere_entrega !== undefined)
    out.requiere_entrega = !!d.requiere_entrega
  if (d.rubrica !== undefined) out.rubrica = Array.isArray(d.rubrica) ? d.rubrica : []
  if (d.visible !== undefined) out.visible = !!d.visible
  if (d.clase_id !== undefined) out.clase_id = d.clase_id || null
  if (d.archivos !== undefined) out.archivos = Array.isArray(d.archivos) ? d.archivos : []
  return out
}
