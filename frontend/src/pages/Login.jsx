import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { iniciarSesion } from '../services/auth.service'
import AuthShell from '../components/AuthShell'
import Alerta from '../components/Alerta'
import CampoContrasena from '../components/CampoContrasena'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  // Aviso que llega desde otros flujos (ej. cambio de contraseña exitoso).
  const aviso = location.state?.aviso

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await iniciarSesion(correo, contrasena)
      // El AuthContext detecta la sesión; mandamos a la raíz y el
      // enrutador redirige por rol / onboarding.
      const destino = location.state?.from?.pathname || '/'
      navigate(destino, { replace: true })
    } catch (err) {
      setError(traducirError(err))
      setCargando(false)
    }
  }

  return (
    <AuthShell
      titulo="Ingresá a tu cuaderno"
      subtitulo="Tus cotidianos, tareas y notas en un solo lugar."
      pie={
        <>
          ¿Todavía no tenés cuenta?{' '}
          <Link to="/registro" className="font-medium text-pizarra hover:underline">
            Registrate
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {aviso && <Alerta tipo="exito">{aviso}</Alerta>}

        <div>
          <label htmlFor="correo" className="etiqueta">
            Correo
          </label>
          <input
            id="correo"
            type="email"
            autoComplete="email"
            required
            className="campo"
            placeholder="vos@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="contrasena" className="etiqueta">
              Contraseña
            </label>
            <Link
              to="/olvide"
              className="mb-1 text-sm font-medium text-pizarra hover:underline"
            >
              ¿La olvidaste?
            </Link>
          </div>
          <CampoContrasena
            id="contrasena"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
        </div>

        <Alerta tipo="error">{error}</Alerta>

        <button type="submit" className="btn-primario w-full" disabled={cargando}>
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </AuthShell>
  )
}

// Traduce errores comunes de Supabase a español útil.
function traducirError(err) {
  const msg = err?.message || ''
  if (/invalid login credentials/i.test(msg))
    return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(msg))
    return 'Todavía no confirmaste tu correo. Revisá tu bandeja de entrada.'
  if (/network|fetch/i.test(msg))
    return 'No se pudo conectar. Revisá tu internet e intentá de nuevo.'
  return msg || 'Ocurrió un error al ingresar. Intentá de nuevo.'
}
