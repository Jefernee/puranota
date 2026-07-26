import { supabase } from '../lib/supabase'
import { borrarArchivos } from './storage.service'

// Entregas del estudiante. RLS garantiza que solo ve/edita lo propio y que
// el reemplazo solo se permite antes de la fecha límite y sin calificar.
// El campo `tardia` lo marca un trigger en la base; el frontend no lo toca.

/** Trae la entrega del estudiante para una asignación (o null), con archivos. */
export async function obtenerEntrega(asignacionId, estudianteId) {
  const { data, error } = await supabase
    .from('entregas')
    .select('*, archivos:entrega_archivos(*)')
    .eq('asignacion_id', asignacionId)
    .eq('estudiante_id', estudianteId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Lista las entregas del estudiante para un conjunto de asignaciones. */
export async function listarMisEntregas(estudianteId, asignacionIds) {
  if (!asignacionIds?.length) return []
  const { data, error } = await supabase
    .from('entregas')
    .select('id, asignacion_id, estado, tardia, nota')
    .eq('estudiante_id', estudianteId)
    .in('asignacion_id', asignacionIds)
  if (error) throw error
  return data
}

/**
 * Crea la entrega (estado 'entregada' por defecto). Lanza si RLS no lo permite
 * (ej. fuera de fecha y sin tardías) o si ya existe.
 */
export async function crearEntrega(asignacionId, estudianteId) {
  const { data, error } = await supabase
    .from('entregas')
    .insert({ asignacion_id: asignacionId, estudiante_id: estudianteId })
    .select('*, archivos:entrega_archivos(*)')
    .single()
  if (error) throw error
  return data
}

/** Agrega archivos (ya subidos al almacenamiento) a una entrega. */
export async function agregarArchivos(entregaId, archivos) {
  if (!archivos?.length) return []
  const filas = archivos.map((a) => ({
    entrega_id: entregaId,
    url: a.url,
    nombre: a.nombre,
    tipo: a.tipo,
  }))
  const { data, error } = await supabase
    .from('entrega_archivos')
    .insert(filas)
    .select()
  if (error) throw error
  return data
}

/** Quita un archivo de una entrega (permitido antes de calificar) y lo borra de R2. */
export async function eliminarArchivo(archivoId) {
  const { data } = await supabase
    .from('entrega_archivos')
    .select('url')
    .eq('id', archivoId)
    .maybeSingle()

  const { error } = await supabase
    .from('entrega_archivos')
    .delete()
    .eq('id', archivoId)
  if (error) throw error

  if (data?.url) await borrarArchivos([data.url])
}

/**
 * Cuenta, por grupo, las entregas SIN calificar del docente (estado distinto de
 * 'calificada'). Devuelve { [grupoId]: cantidad }. RLS limita a las entregas de
 * los grupos del docente, así que no hace falta filtrar por docente acá.
 */
export async function contarPorRevisarPorGrupo() {
  const { data, error } = await supabase
    .from('entregas')
    .select('id, asignacion:asignaciones!inner(grupo_id)')
    .neq('estado', 'calificada')
  if (error) throw error
  const out = {}
  for (const e of data || []) {
    const gid = e.asignacion?.grupo_id
    if (gid) out[gid] = (out[gid] || 0) + 1
  }
  return out
}

// ---------------- Docente: revisión ----------------

/**
 * Lista las entregas de una asignación con sus archivos y el perfil del
 * estudiante. RLS deja al docente ver solo las de sus grupos.
 */
export async function listarEntregasDeAsignacion(asignacionId) {
  const { data, error } = await supabase
    .from('entregas')
    .select(
      '*, archivos:entrega_archivos(*), estudiante:perfiles(id, nombre, correo)',
    )
    .eq('asignacion_id', asignacionId)
  if (error) throw error
  return data
}

/**
 * Entregas (resumidas) de varias asignaciones, para el cuadro de notas del
 * docente. RLS deja al docente ver solo las de sus grupos.
 */
export async function listarEntregasDeAsignaciones(asignacionIds) {
  if (!asignacionIds?.length) return []
  const { data, error } = await supabase
    .from('entregas')
    .select('estudiante_id, asignacion_id, estado, nota, tardia')
    .in('asignacion_id', asignacionIds)
  if (error) throw error
  return data
}

/**
 * Califica (o re-califica) una entrega. Marca estado 'calificada' y la fecha.
 * Validar nota contra los puntos máximos antes de llamar.
 */
export async function calificarEntrega(entregaId, { nota, observaciones }) {
  const { data, error } = await supabase
    .from('entregas')
    .update({
      nota,
      observaciones: observaciones?.trim() || null,
      estado: 'calificada',
      calificado_en: new Date().toISOString(),
    })
    .eq('id', entregaId)
    .select('*, archivos:entrega_archivos(*), estudiante:perfiles(id, nombre, correo)')
    .single()
  if (error) throw error
  return data
}

/**
 * Califica directamente a un estudiante creando la entrega si no existe (para
 * pruebas escritas / nota directa, donde el estudiante no entrega nada). Hace
 * upsert contra el unique (asignacion_id, estudiante_id). Requiere la política
 * RLS "docente crea entrega".
 */
export async function calificarPorEstudiante(
  asignacionId,
  estudianteId,
  { nota, observaciones },
) {
  const { data, error } = await supabase
    .from('entregas')
    .upsert(
      {
        asignacion_id: asignacionId,
        estudiante_id: estudianteId,
        nota,
        observaciones: observaciones?.trim() || null,
        estado: 'calificada',
        calificado_en: new Date().toISOString(),
      },
      { onConflict: 'asignacion_id,estudiante_id' },
    )
    .select('*, archivos:entrega_archivos(*), estudiante:perfiles(id, nombre, correo)')
    .single()
  if (error) throw error
  return data
}
