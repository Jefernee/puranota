import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Cargando from './components/Cargando'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Registro from './pages/Registro'
import OlvideContrasena from './pages/OlvideContrasena'
import Restablecer from './pages/Restablecer'
import Onboarding from './pages/Onboarding'
import MiCuenta from './pages/MiCuenta'
import CambiarClaveObligatorio from './pages/CambiarClaveObligatorio'
import DashboardDocente from './pages/docente/Dashboard'
import GrupoDetalle from './pages/docente/GrupoDetalle'
import Revision from './pages/docente/Revision'
import DashboardEstudiante from './pages/estudiante/Dashboard'
import GrupoEstudiante from './pages/estudiante/Grupo'
import AsignacionEstudiante from './pages/estudiante/Asignacion'
import NoEncontrado from './pages/NoEncontrado'

// Decide a dónde mandar la raíz "/" según sesión, onboarding y rol.
function Inicio() {
  const {
    usuario,
    perfil,
    cargando,
    esDocente,
    onboardingCompleto,
    debeCambiarClave,
  } = useAuth()

  if (cargando) return <Cargando />
  if (!usuario) return <Navigate to="/login" replace />
  if (!perfil) return <Cargando texto="Preparando tu cuaderno…" />
  if (!onboardingCompleto) return <Navigate to="/onboarding" replace />
  if (debeCambiarClave) return <Navigate to="/cambiar-clave" replace />
  return <Navigate to={esDocente ? '/docente' : '/estudiante'} replace />
}

// Redirige a quien ya tiene sesión fuera de login/registro.
function SoloInvitados({ children }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <Cargando />
  if (usuario) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />

      <Route
        path="/login"
        element={
          <SoloInvitados>
            <Login />
          </SoloInvitados>
        }
      />
      <Route
        path="/registro"
        element={
          <SoloInvitados>
            <Registro />
          </SoloInvitados>
        }
      />

      {/* Recuperación de contraseña */}
      <Route
        path="/olvide"
        element={
          <SoloInvitados>
            <OlvideContrasena />
          </SoloInvitados>
        }
      />
      {/* Restablecer: llega desde el link del correo. SIN SoloInvitados, porque
          el token crea una sesión temporal de recovery que, de otro modo,
          expulsaría al usuario antes de mostrar el formulario. */}
      <Route path="/restablecer" element={<Restablecer />} />

      {/* Onboarding: requiere sesión, pero no rol ni onboarding completo. */}
      <Route path="/onboarding" element={<OnboardingGuard />} />

      {/* Cambio de contraseña forzado tras un reset del docente. */}
      <Route path="/cambiar-clave" element={<CambiarClaveGuard />} />

      {/* Mi cuenta: cualquier usuario logueado. */}
      <Route
        path="/cuenta"
        element={
          <ProtectedRoute>
            <MiCuenta />
          </ProtectedRoute>
        }
      />

      {/* Área docente */}
      <Route
        path="/docente"
        element={
          <ProtectedRoute rol="docente">
            <DashboardDocente />
          </ProtectedRoute>
        }
      />
      <Route
        path="/docente/grupos/:id"
        element={
          <ProtectedRoute rol="docente">
            <GrupoDetalle />
          </ProtectedRoute>
        }
      />
      <Route
        path="/docente/asignaciones/:id"
        element={
          <ProtectedRoute rol="docente">
            <Revision />
          </ProtectedRoute>
        }
      />

      {/* Área estudiante */}
      <Route
        path="/estudiante"
        element={
          <ProtectedRoute rol="estudiante">
            <DashboardEstudiante />
          </ProtectedRoute>
        }
      />
      <Route
        path="/estudiante/grupos/:id"
        element={
          <ProtectedRoute rol="estudiante">
            <GrupoEstudiante />
          </ProtectedRoute>
        }
      />
      <Route
        path="/estudiante/asignaciones/:id"
        element={
          <ProtectedRoute rol="estudiante">
            <AsignacionEstudiante />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}

// Guard del onboarding: exige sesión; si ya está completo, sale al área.
function OnboardingGuard() {
  const { usuario, perfil, cargando, esDocente, onboardingCompleto } = useAuth()
  if (cargando) return <Cargando />
  if (!usuario) return <Navigate to="/login" replace />
  if (perfil && onboardingCompleto)
    return <Navigate to={esDocente ? '/docente' : '/estudiante'} replace />
  return <Onboarding />
}

// Guard del cambio forzado: exige sesión y el flag activo; si no, sale a inicio.
function CambiarClaveGuard() {
  const { usuario, perfil, cargando, debeCambiarClave } = useAuth()
  if (cargando) return <Cargando />
  if (!usuario) return <Navigate to="/login" replace />
  if (!perfil) return <Cargando texto="Preparando tu cuaderno…" />
  if (!debeCambiarClave) return <Navigate to="/" replace />
  return <CambiarClaveObligatorio />
}
