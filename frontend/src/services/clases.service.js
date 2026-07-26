import { supabase } from '../lib/supabase'
import { borrarArchivos } from './storage.service'

// Clases de un grupo (contenido + video de YouTube + archivos adjuntos).
// RLS: el docente gestiona las de sus grupos; el estudiante ve solo las visibles.

/** Lista las clases del grupo con sus archivos, ordenadas por `orden`. */
export async function listarClases(grupoId) {
  const { data, error } = await supabase
    .from('clases')
    .select('*, archivos:clase_archivos(*)')
    .eq('grupo_id', grupoId)
    .order('orden', { ascending: true })
    .order('creado_en', { ascending: true })
  if (error) throw error
  return data
}

/** Crea una clase. */
export async function crearClase(grupoId, datos) {
  const { data, error } = await supabase
    .from('clases')
    .insert({ ...limpiar(datos), grupo_id: grupoId })
    .select('*, archivos:clase_archivos(*)')
    .single()
  if (error) throw error
  return data
}

/** Actualiza una clase. */
export async function actualizarClase(claseId, datos) {
  const { data, error } = await supabase
    .from('clases')
    .update(limpiar(datos))
    .eq('id', claseId)
    .select('*, archivos:clase_archivos(*)')
    .single()
  if (error) throw error
  return data
}

/** Cambia la visibilidad de una clase. */
export async function cambiarVisibilidadClase(claseId, visible) {
  const { data, error } = await supabase
    .from('clases')
    .update({ visible: !!visible })
    .eq('id', claseId)
    .select('*, archivos:clase_archivos(*)')
    .single()
  if (error) throw error
  return data
}

/** Elimina una clase (arrastra sus archivos por cascada en la base) y borra los
 * objetos en R2 para no dejar huérfanos. */
export async function eliminarClase(claseId) {
  // Recolectar las URLs ANTES de borrar (la cascada elimina las filas).
  const { data: archivos } = await supabase
    .from('clase_archivos')
    .select('url')
    .eq('clase_id', claseId)

  const { error } = await supabase.from('clases').delete().eq('id', claseId)
  if (error) throw error

  await borrarArchivos((archivos || []).map((a) => a.url))
}

/** Agrega archivos (ya subidos al almacenamiento) a una clase. */
export async function agregarArchivosClase(claseId, archivos) {
  if (!archivos?.length) return []
  const filas = archivos.map((a) => ({
    clase_id: claseId,
    url: a.url,
    nombre: a.nombre,
    tipo: a.tipo,
  }))
  const { data, error } = await supabase
    .from('clase_archivos')
    .insert(filas)
    .select()
  if (error) throw error
  return data
}

/** Quita un archivo de una clase (también lo borra de R2). */
export async function eliminarArchivoClase(archivoId) {
  const { data } = await supabase
    .from('clase_archivos')
    .select('url')
    .eq('id', archivoId)
    .maybeSingle()

  const { error } = await supabase
    .from('clase_archivos')
    .delete()
    .eq('id', archivoId)
  if (error) throw error

  if (data?.url) await borrarArchivos([data.url])
}

// Solo deja pasar las columnas que el formulario maneja.
function limpiar(d) {
  const out = {}
  if (d.titulo !== undefined) out.titulo = d.titulo.trim()
  if (d.contenido !== undefined) out.contenido = d.contenido?.trim() || null
  if (d.youtube_url !== undefined) out.youtube_url = d.youtube_url?.trim() || null
  if (d.youtube_urls !== undefined)
    out.youtube_urls = Array.isArray(d.youtube_urls) ? d.youtube_urls : []
  if (d.orden !== undefined) out.orden = Number(d.orden) || 0
  if (d.visible !== undefined) out.visible = !!d.visible
  return out
}
