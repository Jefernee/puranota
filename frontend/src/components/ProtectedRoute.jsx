import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Cargando from './Cargando'

/**
 * Protege rutas por sesión, por onboarding y (opcionalmente) por rol.
 *
 * Props:
 *  - rol: 'docente' | 'estudiante' (opcional) — restringe por rol.
 *  - children: contenido protegido.
 */
export default function ProtectedRoute({ rol, children }) {
  const {
    usuario,
    perfil,
    cargando,
    esDocente,
    onboardingCompleto,
    debeCambiarClave,
  } = useAuth()
  const location = useLocation()

  if (cargando) return <Cargando />

  // Sin sesión → al login.
  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Con sesión pero el perfil aún no carga (caso raro de carrera).
  if (!perfil) return <Cargando texto="Preparando tu cuaderno…" />

  // Onboarding obligatorio antes de entrar a cualquier área.
  if (!onboardingCompleto) {
    return <Navigate to="/onboarding" replace />
  }

  // Cambio de contraseña forzado tras un reset del docente.
  if (debeCambiarClave) {
    return <Navigate to="/cambiar-clave" replace />
  }

  // Restricción por rol: si no corresponde, lo mando a su área.
  if (rol) {
    const rolUsuario = esDocente ? 'docente' : 'estudiante'
    if (rolUsuario !== rol) {
      return <Navigate to={esDocente ? '/docente' : '/estudiante'} replace />
    }
  }

  return children
}
