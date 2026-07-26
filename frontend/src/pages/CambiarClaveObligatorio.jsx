import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cambiarContrasena, cerrarSesion } from '../services/auth.service'
import { limpiarDebeCambiarClave } from '../services/perfil.service'
import AuthShell from '../components/AuthShell'
import Alerta from '../components/Alerta'
import CampoContrasena from '../components/CampoContrasena'

// Pantalla obligatoria tras un reset del docente: el usuario DEBE elegir una
// contraseña nueva antes de usar la app. No pide la actual (viene de la temporal
// con la que recién ingresó).
export default function CambiarClaveObligatorio() {
  const { usuario, refrescarPerfil } = useAuth()
  const navigate = useNavigate()
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (nueva.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setCargando(true)
    try {
      await cambiarContrasena(nueva)
      await limpiarDebeCambiarClave(usuario.id)
      await refrescarPerfil()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message || 'No se pudo cambiar la contraseña.')
      setCargando(false)
    }
  }

  async function handleSalir() {
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <AuthShell
      titulo="Creá tu nueva contraseña"
      subtitulo="Tu profe reseteó tu clave. Elegí una nueva para continuar."
      pie={
        <button onClick={handleSalir} className="text-tinta/60 hover:underline">
          Cerrar sesión
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="nueva" className="etiqueta">
            Nueva contraseña
          </label>
          <CampoContrasena
            id="nueva"
            autoComplete="new-password"
            required
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="confirmar" className="etiqueta">
            Repetí la contraseña
          </label>
          <CampoContrasena
            id="confirmar"
            autoComplete="new-password"
            required
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
        </div>
        <Alerta tipo="error">{error}</Alerta>
        <button type="submit" className="btn-primario w-full" disabled={cargando}>
          {cargando ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </form>
    </AuthShell>
  )
}
