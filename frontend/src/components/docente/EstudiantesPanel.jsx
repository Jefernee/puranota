import { useEffect, useState } from 'react'
import Alerta from '../Alerta'
import Modal from '../Modal'
import EstadoVacio from '../EstadoVacio'
import SkeletonLista from '../SkeletonLista'
import {
  listarEstudiantes,
  aprobarEstudiante,
  expulsarEstudiante,
} from '../../services/grupos.service'
import { resetearClaveEstudiante } from '../../services/perfil.service'

// Lista de estudiantes del grupo con estado, aprobar pendientes y expulsar.
export default function EstudiantesPanel({ grupoId }) {
  const [estudiantes, setEstudiantes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [accionando, setAccionando] = useState(null) // id en proceso
  const [confirmExpulsar, setConfirmExpulsar] = useState(null)

  // Reset de contraseña
  const [resetEstudiante, setResetEstudiante] = useState(null) // perfil objetivo
  const [resetClave, setResetClave] = useState('') // temporal generada
  const [reseteando, setReseteando] = useState(false)
  const [resetError, setResetError] = useState('')
  const [copiado, setCopiado] = useState(false)

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      setEstudiantes(await listarEstudiantes(grupoId))
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los estudiantes.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId])

  async function aprobar(id) {
    setAccionando(id)
    setError('')
    try {
      await aprobarEstudiante(id)
      await cargar()
    } catch (e) {
      setError(e?.message || 'No se pudo aprobar.')
    } finally {
      setAccionando(null)
    }
  }

  async function expulsar(id) {
    setAccionando(id)
    setError('')
    try {
      await expulsarEstudiante(id)
      setConfirmExpulsar(null)
      await cargar()
    } catch (e) {
      setError(e?.message || 'No se pudo expulsar.')
    } finally {
      setAccionando(null)
    }
  }

  function abrirReset(estudiante) {
    setResetEstudiante(estudiante)
    setResetClave('')
    setResetError('')
    setCopiado(false)
  }

  async function confirmarReset() {
    setReseteando(true)
    setResetError('')
    try {
      const temp = await resetearClaveEstudiante(resetEstudiante.id)
      setResetClave(temp)
    } catch (e) {
      setResetError(e?.message || 'No se pudo resetear la contraseña.')
    } finally {
      setReseteando(false)
    }
  }

  async function copiarClave() {
    try {
      await navigator.clipboard.writeText(resetClave)
      setCopiado(true)
    } catch {
      /* el docente puede copiarla a mano */
    }
  }

  const pendientes = estudiantes.filter((e) => e.estado === 'pendiente').length

  if (cargando) return <SkeletonLista />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-tinta/70">
          {estudiantes.length} matriculado{estudiantes.length === 1 ? '' : 's'}
          {pendientes > 0 && (
            <span className="ml-2 rounded-full bg-guaria/10 px-2 py-0.5 text-sm font-medium text-guaria">
              {pendientes} pendiente{pendientes === 1 ? '' : 's'}
            </span>
          )}
        </p>
        <button onClick={cargar} className="text-sm text-pizarra hover:underline">
          Actualizar
        </button>
      </div>

      <Alerta tipo="error">{error}</Alerta>

      {estudiantes.length === 0 ? (
        <EstadoVacio icono="👥" titulo="Todavía no hay estudiantes">
          Compartí el código de acceso o cargá la pre-matrícula.
        </EstadoVacio>
      ) : (
        <ul className="divide-y divide-tinta/10 overflow-hidden rounded-cuaderno border border-tinta/15 bg-superficie shadow-sm">
          {estudiantes.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-tinta">
                  {e.estudiante?.nombre || '(sin nombre todavía)'}
                </p>
                <p className="truncate text-sm text-tinta/60">
                  {e.estudiante?.correo}
                  {e.estudiante?.seccion ? ` · ${e.estudiante.seccion}` : ''}
                </p>
              </div>

              <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                {e.estado === 'pendiente' ? (
                  <span className="rounded-full bg-guaria/10 px-2.5 py-0.5 text-sm font-medium text-guaria">
                    Pendiente
                  </span>
                ) : (
                  <span className="rounded-full bg-pizarra/10 px-2.5 py-0.5 text-sm font-medium text-pizarra">
                    Activo
                  </span>
                )}

                {e.estado === 'pendiente' && (
                  <button
                    onClick={() => aprobar(e.id)}
                    disabled={accionando === e.id}
                    className="btn-accion bg-pizarra text-papel hover:bg-pizarra/90"
                  >
                    Aprobar
                  </button>
                )}

                {e.estudiante?.id && (
                  <button
                    onClick={() => abrirReset(e.estudiante)}
                    className="btn-accion text-guaria hover:bg-guaria/10"
                    title="Resetear contraseña"
                  >
                    Resetear clave
                  </button>
                )}

                <button
                  onClick={() => setConfirmExpulsar(e)}
                  className="btn-accion text-tinta/60 hover:bg-margen/10 hover:text-margen"
                  title="Expulsar del grupo"
                >
                  Expulsar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de confirmación para expulsar */}
      <Modal
        abierto={!!confirmExpulsar}
        onCerrar={() =>
          accionando === confirmExpulsar?.id ? null : setConfirmExpulsar(null)
        }
        titulo="¿Expulsar del grupo?"
      >
        <p className="text-sm leading-relaxed text-tinta/80">
          Vas a sacar a{' '}
          <strong>
            {confirmExpulsar?.estudiante?.nombre ||
              confirmExpulsar?.estudiante?.correo}
          </strong>{' '}
          del grupo. Perderá acceso a las asignaciones, clases y notas de este
          grupo. Podés volver a agregarlo con el código o la pre-matrícula.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="btn-secundario"
            onClick={() => setConfirmExpulsar(null)}
            disabled={accionando === confirmExpulsar?.id}
          >
            Cancelar
          </button>
          <button
            className="btn-primario !bg-margen hover:!bg-margen/90"
            onClick={() => expulsar(confirmExpulsar.id)}
            disabled={accionando === confirmExpulsar?.id}
          >
            {accionando === confirmExpulsar?.id ? 'Expulsando…' : 'Sí, expulsar'}
          </button>
        </div>
      </Modal>

      {/* Modal de reset de contraseña */}
      <Modal
        abierto={!!resetEstudiante}
        onCerrar={() => setResetEstudiante(null)}
        titulo="Resetear contraseña"
      >
        {!resetClave ? (
          <div className="space-y-4">
            <p className="text-sm text-tinta/80">
              Vas a generar una contraseña temporal para{' '}
              <strong>
                {resetEstudiante?.nombre || resetEstudiante?.correo}
              </strong>
              . La actual dejará de funcionar y el estudiante deberá cambiarla al
              entrar. No podés ver su contraseña, solo resetearla.
            </p>
            <Alerta tipo="error">{resetError}</Alerta>
            <div className="flex justify-end gap-2">
              <button
                className="btn-secundario"
                onClick={() => setResetEstudiante(null)}
                disabled={reseteando}
              >
                Cancelar
              </button>
              <button
                className="btn-primario"
                onClick={confirmarReset}
                disabled={reseteando}
              >
                {reseteando ? 'Generando…' : 'Generar contraseña temporal'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-tinta/80">
              Contraseña temporal de{' '}
              <strong>
                {resetEstudiante?.nombre || resetEstudiante?.correo}
              </strong>
              . Pasásela y pedile que la cambie al entrar:
            </p>
            <div className="flex items-center justify-between gap-3 rounded-cuaderno border border-guaria/30 bg-guaria/10 px-4 py-3">
              <code className="select-all font-mono text-xl font-bold tracking-wider text-tinta">
                {resetClave}
              </code>
              <button className="btn-secundario px-3 py-1.5 text-sm" onClick={copiarClave}>
                {copiado ? 'Copiado ✓' : 'Copiar'}
              </button>
            </div>
            <p className="text-sm text-tinta/65">
              Al ingresar con esta clave, el estudiante será llevado
              obligatoriamente a crear una nueva.
            </p>
            <div className="flex justify-end">
              <button className="btn-primario" onClick={() => setResetEstudiante(null)}>
                Listo
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
