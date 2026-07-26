import { supabase } from '../lib/supabase'

// Avisos del docente a sus estudiantes, dirigidos a uno o varios grupos.
// RLS (ya en la base): el docente gestiona los suyos; el estudiante solo ve
// los avisos de los grupos donde está activo.

/** Crea un aviso dirigido a los grupos indicados (array de ids). */
export async function crearAnuncio(docenteId, contenido, grupoIds) {
  const { data, error } = await supabase
    .from('anuncios')
    .insert({ docente_id: docenteId, contenido, grupo_ids: grupoIds })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Lista los avisos del docente, más recientes primero. */
export async function listarAnunciosDocente(docenteId) {
  const { data, error } = await supabase
    .from('anuncios')
    .select('*')
    .eq('docente_id', docenteId)
    .order('creado_en', { ascending: false })
  if (error) throw error
  return data
}

/** Borra un aviso del docente. */
export async function borrarAnuncio(id) {
  const { error } = await supabase.from('anuncios').delete().eq('id', id)
  if (error) throw error
}

/**
 * Avisos visibles para el estudiante. La política RLS ya filtra a los grupos
 * donde el estudiante está activo, así que basta con traerlos ordenados.
 */
export async function listarAnunciosEstudiante() {
  const { data, error } = await supabase
    .from('anuncios')
    .select('*')
    .order('creado_en', { ascending: false })
  if (error) throw error
  return data
}
