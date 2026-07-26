import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Alerta from '../components/Alerta'
import CampoContrasena from '../components/CampoContrasena'
import Volver from '../components/Volver'
import {
  cambiarContrasena,
  definirPregunta,
  cambiarCorreo,
} from '../services/auth.service'
import { actualizarPerfil } from '../services/perfil.service'
import { PREGUNTAS_SEGURIDAD } from '../lib/preguntas-seguridad'

export default function MiCuenta() {
  const { perfil, esDocente } = useAuth()
  const inicial = (perfil?.nombre?.trim()?.[0] || '?').toUpperCase()

  return (
    <Layout ancho="normal">
      {/* Encabezado: Volver + avatar + nombre en la misma línea; datos debajo */}
      <div className="mb-6 border-b border-tinta/10 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <Volver to="/" atras>
            Volver
          </Volver>
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-bold text-papel shadow-sm ${
              esDocente ? 'bg-guaria' : 'bg-pizarra'
            }`}
          >
            {inicial}
          </span>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            {perfil?.nombre || 'Mi cuenta'}
          </h1>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              esDocente
                ? 'border-guaria/20 bg-guaria/10 text-guaria'
                : 'border-pizarra/20 bg-pizarra/10 text-pizarra'
            }`}
          >
            {esDocente ? 'Docente' : 'Estudiante'}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <DatosPersonales perfil={perfil} />
        <CambiarClave />
        <PreguntaSeguridad perfil={perfil} />
      </div>
    </Layout>
  )
}

function DatosPersonales({ perfil }) {
  const { usuario, refrescarPerfil } = useAuth()
  const [nombre, setNombre] = useState(perfil?.nombre || '')
  const [telefono, setTelefono] = useState(perfil?.telefono || '')
  const [seccion, setSeccion] = useState(perfil?.seccion || '')
  const [correo, setCorreo] = useState(perfil?.correo || '')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    if (!nombre.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }
    const tel = telefono.trim()
    if (tel && !/^\d{8}$/.test(tel)) {
      setError('El teléfono debe tener 8 dígitos.')
      return
    }
    const nuevoCorreo = correo.trim().toLowerCase()
    const correoActual = (perfil?.correo || '').toLowerCase()
    const cambioCorreo = !!nuevoCorreo && nuevoCorreo !== correoActual
    if (cambioCorreo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoCorreo)) {
      setError('El correo no es válido.')
      return
    }
    setCargando(true)
    try {
      // El correo (es el login) lo cambia la Edge Function: auth + perfiles, al
      // instante. El resto de datos van directo a la tabla perfiles.
      if (cambioCorreo) await cambiarCorreo(nuevoCorreo)
      await actualizarPerfil(usuario.id, { nombre, telefono: tel, seccion })
      await refrescarPerfil()
      setOk('Datos actualizados.')
    } catch (err) {
      setError(err?.message || 'No se pudieron guardar los datos.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="tarjeta-cuaderno space-y-3 px-5 py-4 pl-7"
      noValidate
    >
      <p className="font-display text-base font-semibold text-tinta">
        Datos personales
      </p>
      <div>
        <label htmlFor="d-nombre" className="etiqueta">
          Nombre completo
        </label>
        <input
          id="d-nombre"
          className="campo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="d-tel" className="etiqueta">
          Teléfono
        </label>
        <input
          id="d-tel"
          className="campo"
          inputMode="numeric"
          maxLength={8}
          placeholder="88887777"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <div>
        <label htmlFor="d-seccion" className="etiqueta">
          Sección
        </label>
        <input
          id="d-seccion"
          className="campo"
          value={seccion}
          onChange={(e) => setSeccion(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="d-correo" className="etiqueta">
          Correo
        </label>
        <input
          id="d-correo"
          type="email"
          className="campo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <p className="mt-1 text-xs text-tinta/60">
          Es también tu usuario para iniciar sesión.
        </p>
      </div>
      <Alerta tipo="error">{error}</Alerta>
      <Alerta tipo="exito">{ok}</Alerta>
      <button className="btn-primario w-full" disabled={cargando}>
        {cargando ? 'Guardando…' : 'Guardar datos'}
      </button>
    </form>
  )
}

function CambiarClave() {
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    if (nueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }
    setCargando(true)
    try {
      // La sesión ya está iniciada: no hace falta re-pedir la contraseña actual.
      await cambiarContrasena(nueva)
      setOk('Contraseña actualizada.')
      setNueva('')
      setConfirmar('')
    } catch (err) {
      setError(err?.message || 'No se pudo cambiar la contraseña.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tarjeta-cuaderno space-y-3 px-5 py-4 pl-7" noValidate>
      <p className="font-display text-base font-semibold text-tinta">
        Cambiar contraseña
      </p>
      <div>
        <label htmlFor="c-nueva" className="etiqueta">
          Nueva contraseña
        </label>
        <CampoContrasena
          id="c-nueva"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="c-confirmar" className="etiqueta">
          Repetí la nueva
        </label>
        <CampoContrasena
          id="c-confirmar"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          required
        />
      </div>
      <Alerta tipo="error">{error}</Alerta>
      <Alerta tipo="exito">{ok}</Alerta>
      <button className="btn-primario w-full" disabled={cargando}>
        {cargando ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}

function PreguntaSeguridad({ perfil }) {
  const [pregunta, setPregunta] = useState(
    perfil?.pregunta_seguridad || PREGUNTAS_SEGURIDAD[0],
  )
  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    if (respuesta.trim().length < 2) {
      setError('Escribí la respuesta.')
      return
    }
    setCargando(true)
    try {
      await definirPregunta(pregunta, respuesta)
      setOk('Pregunta de seguridad actualizada.')
      setRespuesta('')
    } catch (err) {
      setError(err?.message || 'No se pudo guardar.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tarjeta-cuaderno space-y-3 px-5 py-4 pl-7" noValidate>
      <p className="font-display text-base font-semibold text-tinta">
        Pregunta de seguridad
      </p>
      <p className="text-xs text-tinta/65">
        Sirve para recuperar tu contraseña sin correo. Por seguridad no mostramos
        tu respuesta anterior; si la cambiás, escribí una nueva.
      </p>
      <div>
        <label htmlFor="p-pregunta" className="etiqueta">
          Pregunta
        </label>
        <select
          id="p-pregunta"
          className="campo"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
        >
          {PREGUNTAS_SEGURIDAD.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="p-respuesta" className="etiqueta">
          Respuesta
        </label>
        <input
          id="p-respuesta"
          type="text"
          className="campo"
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
        />
      </div>
      <Alerta tipo="error">{error}</Alerta>
      <Alerta tipo="exito">{ok}</Alerta>
      <button className="btn-primario w-full" disabled={cargando}>
        {cargando ? 'Guardando…' : 'Guardar pregunta'}
      </button>
    </form>
  )
}
