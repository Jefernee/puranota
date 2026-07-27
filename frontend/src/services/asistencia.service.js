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
    .select('estudiante_id, fecha, estado, lecciones_perdidas')
    .eq('grupo_id', grupoId)
  if (error) throw error
  return data
}

/**
 * Quita la marca de asistencia de un estudiante en una fecha.
 *
 * Hace falta poder desmarcar: el docente toca "Ausente" por error y, sin esto,
 * la única salida era dejar puesto algo que no pasó. Un día sin registro no es
 * lo mismo que un día marcado presente: no cuenta como lección impartida.
 */
export async function borrarAsistencia(grupoId, estudianteId, fecha) {
  const { error } = await supabase
    .from('asistencia')
    .delete()
    .eq('grupo_id', grupoId)
    .eq('estudiante_id', estudianteId)
    .eq('fecha', fecha)
  if (error) throw new Error('No se pudo quitar la marca.')
}

/**
 * Marca (o actualiza) la asistencia de un estudiante en una fecha.
 * Upsert contra el unique (grupo_id, estudiante_id, fecha).
 */
export async function marcarAsistencia(
  grupoId,
  estudianteId,
  fecha,
  estado,
  leccionesPerdidas = null,
) {
  const { data, error } = await supabase
    .from('asistencia')
    .upsert(
      {
        grupo_id: grupoId,
        estudiante_id: estudianteId,
        fecha,
        estado,
        // Solo tiene sentido en una fuga: cuántas lecciones del día se perdió.
        lecciones_perdidas: estado === 'fuga' ? leccionesPerdidas || 1 : null,
      },
      { onConflict: 'grupo_id,estudiante_id,fecha' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}
