import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  obtenerSesion,
  alRecuperarClave,
  cambiarContrasena,
  cerrarSesion,
} from '../services/auth.service'
import AuthShell from '../components/AuthShell'
import Alerta from '../components/Alerta'
import CampoContrasena from '../components/CampoContrasena'

// Página a la que llega el link del correo de recuperación.
// Va FUERA de <SoloInvitados>: el link crea una sesión temporal de recovery, y
// si la envolviéramos en SoloInvitados el router expulsaría al usuario al
// dashboard antes de mostrar este formulario (eso causaba la "página en blanco").

// Lee parámetros tanto del hash (#access_token=…&type=recovery, flujo implícito
// de Supabase) como del query (?error=…), para ser robustos a ambas formas.
function leerParams() {
  const hash = window.location.hash.replace(/^#/, '')
  const enHash = new URLSearchParams(hash)
  const enQuery = new URLSearchParams(window.location.search)
  return (clave) => enHash.get(clave) || enQuery.get(clave)
}

export default function Restablecer() {
  const navigate = useNavigate()
  // 'verificando' → leyendo el link · 'formulario' → listo · 'invalido' → link vencido/erróneo
  const [estado, setEstado] = useState('verificando')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const get = leerParams()

    // Supabase reporta links vencidos/erróneos en error/error_description.
    if (get('error') || get('error_description')) {
      setEstado('invalido')
      return
    }

    // Señal directa del link de recovery.
    if (get('type') === 'recovery' || get('access_token')) {
      setEstado('formulario')
      return
    }

    // Sin señal en la URL: tal vez el SDK ya consumió el hash, o el evento
    // PASSWORD_RECOVERY llega un instante después. Escuchamos y revisamos sesión.
    let activo = true
    const desuscribir = alRecuperarClave(() => {
      if (activo) setEstado('formulario')
    })
    obtenerSesion().then((s) => {
      if (activo && s) setEstado('formulario')
    })
    // Si tras unos segundos no hubo recovery, el link no sirve.
    const t = setTimeout(() => {
      if (activo) setEstado('invalido')
    }, 5000)

    return () => {
      activo = false
      desuscribir()
      clearTimeout(t)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (nueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setCargando(true)
    try {
      // La sesión temporal de recovery permite cambiar la clave sin la anterior.
      await cambiarContrasena(nueva)
      // Cerramos la sesión temporal para que entre limpio con su clave nueva.
      await cerrarSesion()
      navigate('/login', {
        replace: true,
        state: { aviso: 'Listo, tu contraseña se cambió. Ingresá con la nueva.' },
      })
    } catch (err) {
      setError(
        err?.message ||
          'No se pudo cambiar la contraseña. Pedí un correo de recuperación nuevo.',
      )
      setCargando(false)
    }
  }

  if (estado === 'verificando') {
    return (
      <AuthShell titulo="Restablecer contraseña" subtitulo="Validando tu enlace…">
        <p className="text-sm text-tinta/60">Un momento…</p>
      </AuthShell>
    )
  }

  if (estado === 'invalido') {
    return (
      <AuthShell
        titulo="Enlace no válido"
        subtitulo="El enlace de recuperación venció o ya se usó."
        pie={
          <Link to="/olvide" className="font-medium text-pizarra hover:underline">
            Pedir uno nuevo
          </Link>
        }
      >
        <Alerta tipo="error">
          Los enlaces de recuperación caducan por seguridad. Volvé a “¿Olvidaste tu
          contraseña?” y solicitá otro correo, o usá tu pregunta de seguridad.
        </Alerta>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      titulo="Creá tu nueva contraseña"
      subtitulo="Elegí una contraseña nueva para tu cuenta."
      pie={
        <Link to="/login" className="font-medium text-pizarra hover:underline">
          Volver a ingresar
        </Link>
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
          {cargando ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </AuthShell>
  )
}
