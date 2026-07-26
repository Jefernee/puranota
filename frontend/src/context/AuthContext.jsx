import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { obtenerSesion, alCambiarSesion } from '../services/auth.service'
import { obtenerPerfil } from '../services/perfil.service'

// Estado global: sesión de Supabase + perfil del usuario (rol, onboarding, etc.)

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  // Carga (o recarga) el perfil del usuario logueado.
  const refrescarPerfil = useCallback(async (userId) => {
    if (!userId) {
      setPerfil(null)
      return null
    }
    try {
      const p = await obtenerPerfil(userId)
      setPerfil(p)
      return p
    } catch (e) {
      console.error('No se pudo cargar el perfil:', e)
      setPerfil(null)
      return null
    }
  }, [])

  useEffect(() => {
    let activo = true

    // 1) Sesión inicial al cargar la app.
    obtenerSesion()
      .then(async (s) => {
        if (!activo) return
        setSession(s)
        await refrescarPerfil(s?.user?.id)
      })
      .catch((e) => console.error('Error obteniendo sesión:', e))
      .finally(() => {
        if (activo) setCargando(false)
      })

    // 2) Suscripción a cambios (login / logout / refresh de token).
    const desuscribir = alCambiarSesion(async (s) => {
      if (!activo) return
      setSession(s)
      await refrescarPerfil(s?.user?.id)
    })

    return () => {
      activo = false
      desuscribir()
    }
  }, [refrescarPerfil])

  const valor = {
    session,
    usuario: session?.user ?? null,
    perfil,
    cargando,
    esDocente: perfil?.rol === 'docente',
    onboardingCompleto: !!perfil?.onboarding_completo,
    debeCambiarClave: !!perfil?.debe_cambiar_clave,
    refrescarPerfil: () => refrescarPerfil(session?.user?.id),
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
