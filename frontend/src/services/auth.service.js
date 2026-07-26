import { supabase } from '../lib/supabase'

// Capa de servicios de autenticación.
// Los componentes nunca tocan supabase.auth directamente: pasan por aquí.

/**
 * Registra un usuario con correo y contraseña.
 * Devuelve { necesitaConfirmar } para que la UI muestre el aviso
 * "confirmá tu correo" cuando Supabase tiene la confirmación activada.
 */
export async function registrarse(correo, contrasena) {
  const { data, error } = await supabase.auth.signUp({
    email: correo.trim().toLowerCase(),
    password: contrasena,
  })
  if (error) throw error

  // Si no hay sesión pero sí usuario, Supabase está esperando confirmación.
  const necesitaConfirmar = !data.session && !!data.user
  return { user: data.user, session: data.session, necesitaConfirmar }
}

/** Inicia sesión con correo y contraseña. */
export async function iniciarSesion(correo, contrasena) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo.trim().toLowerCase(),
    password: contrasena,
  })
  if (error) throw error
  return data
}

/** Cierra la sesión actual. */
export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Devuelve la sesión actual (o null). */
export async function obtenerSesion() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Suscribe a cambios de sesión (login/logout/refresh).
 * Devuelve una función para desuscribirse.
 */
export function alCambiarSesion(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}

/** Reenvía el correo de confirmación de registro. */
export async function reenviarConfirmacion(correo) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: correo.trim().toLowerCase(),
  })
  if (error) throw error
}

// ---------- Recuperación por correo (flujo nativo de Supabase) ----------

/**
 * Envía el correo de recuperación. El link del correo abre la ruta /restablecer
 * (debe estar en la allowlist de Redirect URLs en Supabase), donde el usuario
 * define su contraseña nueva. `window.location.origin` resuelve dev y prod solo.
 */
export async function recuperarPorCorreo(correo) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    correo.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/restablecer` },
  )
  if (error) throw error
}

/**
 * Suscribe al evento que dispara el link de recuperación. Llama a `callback()`
 * cuando hay una sesión temporal de recovery lista para cambiar la clave.
 * Devuelve una función para desuscribirse.
 */
export function alRecuperarClave(callback) {
  const { data } = supabase.auth.onAuthStateChange((evento, session) => {
    if (evento === 'PASSWORD_RECOVERY' || (evento === 'SIGNED_IN' && session)) {
      callback()
    }
  })
  return () => data.subscription.unsubscribe()
}

/**
 * Cambia la contraseña del usuario logueado.
 * Si se pasa `actual`, primero la verifica re-autenticando (para "Cambiar
 * contraseña" donde el usuario la recuerda). En el cambio forzado tras un
 * reset, se llama sin `actual` (la sesión ya está abierta con la temporal).
 */
export async function cambiarContrasena(nueva, actual) {
  if (actual !== undefined) {
    const { data: sesion } = await supabase.auth.getUser()
    const correo = sesion?.user?.email
    if (!correo) throw new Error('No hay sesión activa.')
    const { error: errLogin } = await supabase.auth.signInWithPassword({
      email: correo,
      password: actual,
    })
    if (errLogin) throw new Error('La contraseña actual no es correcta.')
  }
  const { error } = await supabase.auth.updateUser({ password: nueva })
  if (error) throw error
}

/**
 * Cambia el correo del usuario (es también su usuario de inicio de sesión).
 * Lo hace la Edge Function `cambiar-correo` con service_role: se aplica al
 * instante (sin correo de confirmación) y se refleja en la tabla perfiles.
 * Luego refresca la sesión para que el correo nuevo quede en el token actual.
 */
export async function cambiarCorreo(nuevoCorreo) {
  const correo = nuevoCorreo.trim().toLowerCase()
  const { data, error } = await supabase.functions.invoke('cambiar-correo', {
    body: { correo },
  })
  if (error) throw new Error(await mensajeFuncion(error, 'No se pudo cambiar el correo.'))
  if (data?.error) throw new Error(data.error)
  // El correo nuevo ya está en auth: renovar la sesión para reflejarlo en el token.
  await supabase.auth.refreshSession()
  return { correo: data?.correo || correo }
}

// ---------- Pregunta de seguridad (Edge Function recuperar-clave) ----------

/** Define/actualiza la pregunta de seguridad del usuario logueado. */
export async function definirPregunta(pregunta, respuesta) {
  const { data, error } = await supabase.functions.invoke('recuperar-clave', {
    body: { accion: 'definir', pregunta, respuesta },
  })
  if (error) throw new Error(await mensajeFuncion(error, 'No se pudo guardar la pregunta.'))
  if (data?.error) throw new Error(data.error)
  return data
}

/** Dado un correo, devuelve la pregunta de seguridad de esa cuenta. */
export async function obtenerPregunta(correo) {
  const { data, error } = await supabase.functions.invoke('recuperar-clave', {
    body: { accion: 'pregunta', correo },
  })
  if (error) throw new Error(await mensajeFuncion(error, 'No se pudo buscar la cuenta.'))
  if (data?.error) throw new Error(data.error)
  return data.pregunta
}

/** Verifica la respuesta y, si coincide, establece la nueva contraseña. */
export async function recuperarConRespuesta(correo, respuesta, nuevaContrasena) {
  const { data, error } = await supabase.functions.invoke('recuperar-clave', {
    body: { accion: 'restablecer', correo, respuesta, nuevaContrasena },
  })
  if (error) throw new Error(await mensajeFuncion(error, 'No se pudo restablecer la contraseña.'))
  if (data?.error) throw new Error(data.error)
  return data
}

// Lee el mensaje de error real que devolvió una Edge Function (4xx/5xx).
async function mensajeFuncion(error, porDefecto) {
  try {
    const cuerpo = await error.context?.json?.()
    if (cuerpo?.error) return cuerpo.error
  } catch {
    /* sin cuerpo legible */
  }
  return porDefecto
}
