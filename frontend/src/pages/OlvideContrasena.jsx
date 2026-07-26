import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  obtenerPregunta,
  recuperarConRespuesta,
  recuperarPorCorreo,
  iniciarSesion,
} from '../services/auth.service'
import AuthShell from '../components/AuthShell'
import Alerta from '../components/Alerta'
import CampoContrasena from '../components/CampoContrasena'

// Pantalla de recuperación con 3 caminos:
//  - 'pregunta' → pregunta de seguridad (instantáneo, sin correo)
//  - 'correo'   → correo de recuperación nativo de Supabase
//  - 'docente'  → mensaje guía para pedir ayuda al profe
export default function OlvideContrasena() {
  const [vista, setVista] = useState('menu')

  const subtitulos = {
    menu: 'Elegí cómo querés recuperar tu cuenta.',
    pregunta: 'Respondé tu pregunta de seguridad y entrá al instante.',
    correo: 'Te enviamos un enlace para crear una contraseña nueva.',
    docente: 'Tu profe puede darte una contraseña temporal.',
  }

  return (
    <AuthShell
      titulo="¿Olvidaste tu contraseña?"
      subtitulo={subtitulos[vista]}
      pie={
        <Link to="/login" className="font-medium text-pizarra hover:underline">
          Volver a ingresar
        </Link>
      }
    >
      {vista !== 'menu' && (
        <button
          type="button"
          onClick={() => setVista('menu')}
          className="mb-4 text-sm font-medium text-tinta/60 hover:text-pizarra"
        >
          ← Ver todas las opciones
        </button>
      )}

      {vista === 'menu' && <Menu onElegir={setVista} />}
      {vista === 'pregunta' && <FlujoPregunta />}
      {vista === 'correo' && <FlujoCorreo />}
      {vista === 'docente' && <AyudaDocente />}
    </AuthShell>
  )
}

// ---------- Menú de opciones ----------
function Menu({ onElegir }) {
  return (
    <div className="space-y-3">
      <OpcionMenu
        onClick={() => onElegir('pregunta')}
        titulo="Pregunta de seguridad"
        descripcion="Al instante y sin correo. Respondé tu pregunta y elegí una clave nueva."
        destacado
      />
      <OpcionMenu
        onClick={() => onElegir('correo')}
        titulo="Recibir un correo"
        descripcion="Te mandamos un enlace para restablecerla. Puede tardar unos minutos."
      />
      <OpcionMenu
        onClick={() => onElegir('docente')}
        titulo="Pedir ayuda a tu profe"
        descripcion="Tu docente te genera una contraseña temporal desde su panel."
      />
    </div>
  )
}

function OpcionMenu({ onClick, titulo, descripcion, destacado }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-cuaderno border px-4 py-3 text-left transition-colors hover:border-pizarra hover:bg-pizarra/5 ${
        destacado ? 'border-pizarra/40 bg-pizarra/[0.04]' : 'border-tinta/15 bg-superficie'
      }`}
    >
      <span className="block font-medium text-tinta">{titulo}</span>
      <span className="mt-0.5 block text-sm text-tinta/60">{descripcion}</span>
    </button>
  )
}

// ---------- Opción 1: pregunta de seguridad ----------
function FlujoPregunta() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState('correo') // 'correo' | 'pregunta'
  const [correo, setCorreo] = useState('')
  const [pregunta, setPregunta] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function buscarPregunta(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const p = await obtenerPregunta(correo)
      setPregunta(p)
      setPaso('pregunta')
    } catch (err) {
      setError(err?.message || 'No se pudo buscar la cuenta.')
    } finally {
      setCargando(false)
    }
  }

  async function restablecer(e) {
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
      await recuperarConRespuesta(correo, respuesta, nueva)
      await iniciarSesion(correo, nueva)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message || 'No se pudo restablecer la contraseña.')
    } finally {
      setCargando(false)
    }
  }

  if (paso === 'correo') {
    return (
      <form onSubmit={buscarPregunta} className="space-y-4" noValidate>
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
            autoFocus
          />
        </div>
        <Alerta tipo="error">{error}</Alerta>
        <button type="submit" className="btn-primario w-full" disabled={cargando}>
          {cargando ? 'Buscando…' : 'Continuar'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={restablecer} className="space-y-4" noValidate>
      <div>
        <p className="etiqueta">Tu pregunta de seguridad</p>
        <p className="rounded-cuaderno bg-tinta/[0.04] px-3 py-2 text-sm text-tinta/80">
          {pregunta}
        </p>
      </div>
      <div>
        <label htmlFor="respuesta" className="etiqueta">
          Respuesta
        </label>
        <input
          id="respuesta"
          type="text"
          required
          className="campo"
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          autoFocus
        />
      </div>
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
        {cargando ? 'Guardando…' : 'Cambiar contraseña y entrar'}
      </button>
    </form>
  )
}

// ---------- Opción 2: correo de recuperación ----------
function FlujoCorreo() {
  const [correo, setCorreo] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await recuperarPorCorreo(correo)
      setEnviado(true)
    } catch (err) {
      setError(err?.message || 'No se pudo enviar el correo. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  if (enviado) {
    return (
      <div className="space-y-4">
        <Alerta tipo="exito">
          Si ese correo tiene cuenta, te llegó un enlace para crear tu contraseña
          nueva.
        </Alerta>
        <p className="text-sm text-tinta/70">
          El correo puede tardar unos minutos en llegar. Si no lo ves, revisá la
          carpeta de <strong>spam</strong> o correo no deseado. El enlace abre la
          pantalla para escribir tu contraseña nueva.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
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
          autoFocus
        />
      </div>
      <Alerta tipo="error">{error}</Alerta>
      <button type="submit" className="btn-primario w-full" disabled={cargando}>
        {cargando ? 'Enviando…' : 'Enviarme el correo'}
      </button>
    </form>
  )
}

// ---------- Opción 3: ayuda del docente ----------
function AyudaDocente() {
  return (
    <div className="space-y-4">
      <Alerta tipo="info">
        Pedile a tu profe que te genere una contraseña temporal.
      </Alerta>
      <p className="text-sm text-tinta/70">
        Tu docente puede restablecer tu clave desde su panel. Cuando lo haga, vas a
        entrar con la contraseña temporal que te dé y la app te pedirá crear una
        nueva al ingresar.
      </p>
    </div>
  )
}
