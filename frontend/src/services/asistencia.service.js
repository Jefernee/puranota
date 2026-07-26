import { supabase } from '../lib/supabase'

// Asistencia por grupo y fecha. RLS: el docente gestiona la de sus grupos;
// el estudiante solo ve la propia. Unique (grupo, estudiante, fecha).

/** Registros de asistencia de un grupo en una fecha (YYYY-MM-DD). */
export async function listarAsistenciaFecha(grupoId, fecha) {
  const { data, error } = await supabase
    .from('asistencia')
    .select('*')
    .eq('grupo_id', grupoId)
    .eq('fecha', fecha)
  if (error) throw error
  return data
}

/** Todos los registros del grupo (para el resumen por estudiante). */
export async function listarAsistenciaGrupo(grupoId) {
  const { data, error } = await supabase
    .from('asistencia')
    .select('estudiante_id, fecha, estado')
    .eq('grupo_id', grupoId)
  if (error) throw error
  return data
}

/**
 * Marca (o actualiza) la asistencia de un estudiante en una fecha.
 * Upsert contra el unique (grupo_id, estudiante_id, fecha).
 */
export async function marcarAsistencia(grupoId, estudianteId, fecha, estado) {
  const { data, error } = await supabase
    .from('asistencia')
    .upsert(
      { grupo_id: grupoId, estudiante_id: estudianteId, fecha, estado },
      { onConflict: 'grupo_id,estudiante_id,fecha' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}
