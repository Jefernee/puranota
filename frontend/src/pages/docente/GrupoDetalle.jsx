import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import Volver from '../../components/Volver'
import Alerta from '../../components/Alerta'
import Cargando from '../../components/Cargando'
import Modal from '../../components/Modal'
import Tabs from '../../components/Tabs'
import GrupoForm from '../../components/docente/GrupoForm'
import RubrosEditor from '../../components/docente/RubrosEditor'
import CodigoAcceso from '../../components/docente/CodigoAcceso'
import EstudiantesPanel from '../../components/docente/EstudiantesPanel'
import PrematriculaPanel from '../../components/docente/PrematriculaPanel'
import AsignacionesPanel from '../../components/docente/AsignacionesPanel'
import AsistenciaPanel from '../../components/docente/AsistenciaPanel'
import ClasesPanel from '../../components/docente/ClasesPanel'
import NotasPanel from '../../components/docente/NotasPanel'
import {
  obtenerGrupo,
  actualizarGrupo,
  guardarRubros,
  eliminarGrupo,
} from '../../services/grupos.service'
import { cantidadPeriodos, periodosDeGrupo } from '../../lib/periodos'
import { rubrosCompletosDeModalidad } from '../../lib/mep'

const TABS = [
  { id: 'estudiantes', label: 'Estudiantes', icon: '👥' },
  { id: 'asignaciones', label: 'Asignaciones', icon: '📝' },
  { id: 'asistencia', label: 'Asistencia', icon: '✅' },
  { id: 'clases', label: 'Clases', icon: '🎬' },
  { id: 'notas', label: 'Notas', icon: '📊' },
  { id: 'prematricula', label: 'Pre-matrícula', icon: '✉️' },
  { id: 'rubros', label: 'Rubros', icon: '⚖️' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
]

export default function GrupoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [grupo, setGrupo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Recuerda la pestaña activa por grupo, así al volver (ej. desde Revisión) no
  // te manda de nuevo a "Estudiantes".
  const claveTab = `pn-docente-grupo-tab-${id}`
  const [tab, setTab] = useState(() => {
    try {
      return sessionStorage.getItem(claveTab) || 'estudiantes'
    } catch {
      return 'estudiantes'
    }
  })
  const cambiarTab = (t) => {
    setTab(t)
    try {
      sessionStorage.setItem(claveTab, t)
    } catch {
      /* sin persistencia */
    }
  }
  // Se incrementa para remontar (y así descartar cambios) el formulario de Ajustes.
  const [resetForm, setResetForm] = useState(0)
  const [okAjustes, setOkAjustes] = useState('')
  // Eliminación del grupo (acción destructiva, con confirmación).
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState('')

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      setGrupo(await obtenerGrupo(id))
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el grupo.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleEditar(datos, opciones = {}) {
    const actualizado = await actualizarGrupo(id, datos)
    let grupoFinal = actualizado
    // Restablecer rubros del MEP (solo desde Ajustes): reemplaza los rubros de
    // todos los periodos por los oficiales de la modalidad. Afecta las notas.
    if (opciones.restablecerRubrosMEP && actualizado.mep_modalidad) {
      const rubros = rubrosCompletosDeModalidad(
        actualizado.mep_modalidad,
        periodosDeGrupo(actualizado),
      )
      if (rubros) grupoFinal = await guardarRubros(id, rubros)
    }
    setGrupo(grupoFinal)
    // Remontar el form de Ajustes para que su "modalidad original" se re-sincronice
    // con lo recién guardado; si no, un guardado posterior creería que la modalidad
    // volvió a cambiar y restablecería los rubros del MEP otra vez.
    setResetForm((n) => n + 1)
    setOkAjustes(
      opciones.restablecerRubrosMEP
        ? 'Datos guardados y rubros del MEP restablecidos.'
        : 'Datos del grupo guardados.',
    )
  }

  async function handleRubros(rubros) {
    const actualizado = await guardarRubros(id, rubros)
    setGrupo(actualizado)
  }

  async function handleEliminar() {
    setBorrando(true)
    setErrorBorrar('')
    try {
      await eliminarGrupo(id)
      navigate('/docente')
    } catch (e) {
      setErrorBorrar(e?.message || 'No se pudo eliminar el grupo.')
      setBorrando(false)
    }
  }

  if (cargando) return <Cargando texto="Abriendo el grupo…" />

  if (error || !grupo)
    return (
      <Layout ancho="estrecho">
        <Alerta tipo="error">{error || 'Grupo no encontrado.'}</Alerta>
        <Volver to="/docente" className="mt-4">
          Volver a mis grupos
        </Volver>
      </Layout>
    )

  // Título = la materia (lo descriptivo); la Sección y demás van como cuadritos.
  const tituloGrupo = grupo.materia || grupo.nombre || 'Grupo'
  const chipsGrupo = [
    grupo.nombre !== tituloGrupo ? grupo.nombre : null,
    grupo.especialidad,
    grupo.nivel,
  ].filter(Boolean)

  const panel = (
    <>
      {tab === 'estudiantes' && <EstudiantesPanel grupoId={grupo.id} />}
      {tab === 'asignaciones' && <AsignacionesPanel grupo={grupo} />}
      {tab === 'asistencia' && (
        <AsistenciaPanel grupo={grupo} />
      )}
      {tab === 'clases' && <ClasesPanel grupoId={grupo.id} />}
      {tab === 'notas' && <NotasPanel grupo={grupo} />}
      {tab === 'prematricula' && <PrematriculaPanel grupoId={grupo.id} />}
      {tab === 'rubros' && (
        <div className="tarjeta-cuaderno px-5 py-5 pl-7">
          <RubrosEditor grupo={grupo} onGuardar={handleRubros} />
        </div>
      )}
      {tab === 'ajustes' && (
        <div className="tarjeta-cuaderno px-5 py-5 pl-7">
          <p className="mb-1 text-sm font-medium text-tinta/80">Datos del grupo</p>
          <p className="mb-4 text-xs text-tinta/60">
            Cambiá la materia, especialidad, sección, nivel, cantidad de periodos o
            el Modo MEP. La asistencia y los rubros se ajustan en la pestaña Rubros.
          </p>
          <GrupoForm
            key={resetForm}
            inicial={grupo}
            onGuardar={handleEditar}
            onCancelar={() => {
              setOkAjustes('')
              setResetForm((n) => n + 1)
            }}
            textoBoton="Guardar cambios"
          />
          {okAjustes && (
            <div className="mt-4">
              <Alerta tipo="exito">{okAjustes}</Alerta>
            </div>
          )}

          {/* Eliminar el grupo por completo (botón compacto; el aviso va en el modal). */}
          <div className="mt-6 border-t border-tinta/10 pt-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-cuaderno border border-margen/30 px-3.5 py-2 text-sm font-semibold text-margen transition-colors hover:bg-margen/10"
              onClick={() => {
                setErrorBorrar('')
                setConfirmarBorrar(true)
              }}
            >
              <span aria-hidden="true">🗑️</span> Eliminar grupo
            </button>
          </div>
        </div>
      )}
    </>
  )

  return (
    <Layout ancho="amplio">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-tinta/10 pb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Volver to="/docente">Mis grupos</Volver>
          <span className="text-tinta/25" aria-hidden="true">/</span>
          <h1 className="text-xl font-bold leading-tight text-tinta sm:text-2xl">
            {[tituloGrupo, ...chipsGrupo].join(' · ')}
          </h1>
          <span className="text-sm font-medium text-tinta">
            {grupo.anio} · {cantidadPeriodos(grupo)} periodos
            {!grupo.activo && ' · inactivo'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CodigoAcceso
            grupoId={grupo.id}
            codigo={grupo.codigo_acceso}
            onCambio={(nuevo) => setGrupo((g) => ({ ...g, codigo_acceso: nuevo }))}
          />
        </div>
      </div>

      {/* Navegación: pastillas (todas visibles) en móvil, barra lateral en escritorio. */}
      <div className="lg:hidden">
        <Tabs tabs={TABS} value={tab} onChange={cambiarTab} orientacion="menu" />
      </div>

      <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-7">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <Tabs
              tabs={TABS}
              value={tab}
              onChange={cambiarTab}
              orientacion="vertical"
            />
          </div>
        </aside>
        <div className="min-w-0">{panel}</div>
      </div>

      <Modal
        abierto={confirmarBorrar}
        onCerrar={() => !borrando && setConfirmarBorrar(false)}
        titulo="¿Eliminar el grupo?"
      >
        <p className="text-sm leading-relaxed text-tinta/80">
          Vas a eliminar <b>{grupo.nombre}</b> y <b>todo lo suyo</b>: asignaciones,
          entregas y notas de los estudiantes, clases y asistencia. Esta acción{' '}
          <b>no se puede deshacer</b>.
        </p>
        {errorBorrar && (
          <div className="mt-3">
            <Alerta tipo="error">{errorBorrar}</Alerta>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn-secundario"
            onClick={() => setConfirmarBorrar(false)}
            disabled={borrando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primario !bg-margen hover:!bg-margen/90"
            onClick={handleEliminar}
            disabled={borrando}
          >
            {borrando ? 'Eliminando…' : 'Sí, eliminar el grupo'}
          </button>
        </div>
      </Modal>
    </Layout>
  )
}
