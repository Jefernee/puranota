import { supabase } from '../lib/supabase'

// Capa de servicios del perfil del usuario (tabla public.perfiles).

/**
 * Obtiene el perfil del usuario indicado.
 * El perfil se crea solo por trigger al registrarse; si justo acaba de
 * registrarse puede no existir todavía, en cuyo caso devuelve null.
 */
export async function obtenerPerfil(userId) {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Completa el onboarding obligatorio: nombre, teléfono y sección.
 * Marca onboarding_completo = true. No toca el rol (RLS lo prohíbe).
 */
export async function completarOnboarding(userId, { nombre, telefono, seccion }) {
  const { data, error } = await supabase
    .from('perfiles')
    .update({
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      seccion: seccion.trim(),
      onboarding_completo: true,
    })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Actualiza datos editables del perfil (nombre, teléfono, correo).
 * Solo escribe los campos presentes. RLS permite editar el propio perfil.
 */
export async function actualizarPerfil(userId, campos) {
  const out = {}
  if (campos.nombre !== undefined) out.nombre = campos.nombre.trim()
  if (campos.telefono !== undefined) out.telefono = campos.telefono.trim()
  if (campos.seccion !== undefined) out.seccion = campos.seccion.trim()
  if (campos.correo !== undefined) out.correo = campos.correo.trim().toLowerCase()
  if (Object.keys(out).length === 0) return null
  const { data, error } = await supabase
    .from('perfiles')
    .update(out)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Apaga el flag que obliga a cambiar la contraseña (tras hacerlo). */
export async function limpiarDebeCambiarClave(userId) {
  const { error } = await supabase
    .from('perfiles')
    .update({ debe_cambiar_clave: false })
    .eq('id', userId)
  if (error) throw error
}

/**
 * Resetea la contraseña de un estudiante (solo docente dueño del grupo).
 * Lo hace la Edge Function con service_role; devuelve la contraseña temporal.
 */
export async function resetearClaveEstudiante(estudianteId) {
  const { data, error } = await supabase.functions.invoke(
    'resetear-clave-estudiante',
    { body: { estudianteId } },
  )
  if (error) {
    let detalle = ''
    try {
      detalle = (await error.context?.json?.())?.error || ''
    } catch {
      /* sin cuerpo */
    }
    throw new Error(detalle || 'No se pudo resetear la contraseña.')
  }
  if (data?.error) throw new Error(data.error)
  return data.contrasenaTemporal
}
