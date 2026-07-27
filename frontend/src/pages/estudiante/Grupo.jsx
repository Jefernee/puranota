import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import Volver from '../../components/Volver'
import Alerta from '../../components/Alerta'
import Cargando from '../../components/Cargando'
import Tabs from '../../components/Tabs'
import { etiquetaPeriodo } from '../../lib/periodos'
import { formatearFecha } from '../../lib/formato'
import { calcularEstado, TONO_BADGE } from '../../lib/entregas'
import ClaseContenido from '../../components/ClaseContenido'
import EvaluacionEstudiante from '../../components/estudiante/EvaluacionEstudiante'
import { obtenerGrupo } from '../../services/grupos.service'
import { listarAsignaciones } from '../../services/asignaciones.service'
import { listarMisEntregas } from '../../services/entregas.service'
import { listarClases } from '../../services/clases.service'

export default function GrupoEstudiante() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const [grupo, setGrupo] = useState(null)
  const [items, setItems] = useState([]) // [{asignacion, entrega}]
  const [clases, setClases] = useState([])
  // Recordamos la sección y la clase abiertas (por grupo) para volver a donde
  // estabas: al salir a una asignación y volver, no se pierde el lugar.
  const claveSec = `pn-grupo-sec-${id}`
  const claveClase = `pn-grupo-clase-${id}`
  const leer = (k) => {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  }
  // Deep-link opcional desde el inicio: /grupos/:id?clase=<id> abre esa clase.
  const [searchParams] = useSearchParams()
  const claseParam = searchParams.get('clase')
  // "Asignaciones" y "Notas" se fusionaron en "Evaluación" (ver docs/PLAN.md §8):
  // si quedó guardada una de las viejas, se traduce a la nueva.
  const VIEJAS = { asignaciones: 'evaluacion', notas: 'evaluacion' }
  const [vista, setVista] = useState(() => {
    if (claseParam) return 'clases'
    const guardada = leer(claveSec)
    return VIEJAS[guardada] || guardada || 'evaluacion'
  })
  const [claseSelId, setClaseSelId] = useState(() => claseParam || leer(claveClase))
  const cambiarVista = (v) => {
    setVista(v)
    try {
      sessionStorage.setItem(claveSec, v)
    } catch {}
  }
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const g = await obtenerGrupo(id)
        const [asigs, clasesData] = await Promise.all([
          listarAsignaciones(id), // RLS deja solo las visibles
          listarClases(id), // RLS deja solo las visibles
        ])
        const entregas = await listarMisEntregas(
          usuario.id,
          asigs.map((a) => a.id),
        )
        const porAsig = new Map(entregas.map((e) => [e.asignacion_id, e]))
        if (!vivo) return
        setGrupo(g)
        setItems(asigs.map((a) => ({ asignacion: a, entrega: porAsig.get(a.id) || null })))
        setClases(clasesData)
      } catch (e) {
        if (vivo) setError(e?.message || 'No se pudo cargar el grupo.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [id, usuario.id])

  if (cargando) return <Cargando texto="Abriendo el grupo…" />

  if (error || !grupo)
    return (
      <Layout ancho="estrecho">
        <Alerta tipo="error">{error || 'Grupo no encontrado.'}</Alerta>
        <Volver to="/estudiante" className="mt-4">
          Volver
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

  // Clase activa del "mini-curso": la elegida, o la primera por defecto.
  const claseActiva = clases.find((c) => c.id === claseSelId) || clases[0] || null
  const idxClase = claseActiva
    ? clases.findIndex((c) => c.id === claseActiva.id)
    : -1
  const clasePrev = idxClase > 0 ? clases[idxClase - 1] : null
  const claseSig =
    idxClase >= 0 && idxClase < clases.length - 1 ? clases[idxClase + 1] : null
  const actividadesDeClase = claseActiva
    ? items.filter((it) => it.asignacion.clase_id === claseActiva.id)
    : []
  const tieneVideo = (c) =>
    !!(c.youtube_url || (c.archivos || []).some((a) => a.tipo?.startsWith('video/')))
  const irAClase = (c) => {
    if (!c) return
    setClaseSelId(c.id)
    try {
      sessionStorage.setItem(claveClase, c.id)
      // Guarda la última clase vista (global, persiste entre sesiones) para el
      // "Seguí estudiando" del inicio.
      localStorage.setItem(
        `pn-ultima-clase-${usuario.id}`,
        JSON.stringify({
          grupoId: id,
          grupoNombre: grupo?.nombre,
          claseId: c.id,
          claseTitulo: c.titulo,
        }),
      )
    } catch {}
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const panel = (
    <>
      {vista === 'evaluacion' && (
        <EvaluacionEstudiante grupo={grupo} items={items} clases={clases} />
      )}

      {vista === 'clases' &&
        (clases.length === 0 ? (
          <p className="text-sm text-tinta/60">
            Tu profe todavía no publicó clases.
          </p>
        ) : (
          <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-6">
            {/* Lista de clases: chips deslizables en móvil, columna en escritorio */}
            <nav
              className="mb-4 flex gap-1.5 overflow-x-auto pb-1 lg:mb-0 lg:flex-col lg:overflow-visible lg:pb-0 lg:sticky lg:top-20"
              aria-label="Lista de clases"
            >
              {clases.map((c, i) => {
                const activa = claseActiva?.id === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => irAClase(c)}
                    className={`shrink-0 rounded-cuaderno border px-3 py-2 text-left text-sm shadow-sm transition-colors lg:shrink ${
                      activa
                        ? 'border-pizarra bg-pizarra text-papel'
                        : 'border-tinta/15 bg-superficie text-tinta/70 hover:border-pizarra/40 hover:text-pizarra'
                    }`}
                    aria-current={activa ? 'true' : undefined}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold ${
                          activa ? 'bg-papel/25 text-papel' : 'bg-pizarra/10 text-pizarra'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="hidden min-w-0 items-center gap-1 break-words lg:flex">
                        {c.titulo}
                        {tieneVideo(c) && <span className="shrink-0 text-sm">▶</span>}
                      </span>
                    </span>
                  </button>
                )
              })}
            </nav>

            {/* Contenido de la clase activa */}
            {claseActiva && (
              <article className="min-w-0 space-y-4">
                <header className="flex items-start justify-between gap-4 border-b border-tinta/10 pb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-wide text-tinta/60">
                      Clase {idxClase + 1} de {clases.length}
                    </p>
                    <h2 className="text-lg font-bold leading-snug text-tinta sm:text-2xl">
                      {claseActiva.titulo}
                    </h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => irAClase(clasePrev)}
                      disabled={!clasePrev}
                      className="grid h-10 w-10 place-items-center rounded-full border border-tinta/15 bg-superficie text-xl text-tinta/70 shadow-sm hover:border-pizarra hover:text-pizarra disabled:opacity-30"
                      title="Clase anterior"
                      aria-label="Clase anterior"
                    >
                      ‹
                    </button>
                    {claseSig ? (
                      <button
                        type="button"
                        onClick={() => irAClase(claseSig)}
                        className="btn-primario"
                      >
                        Siguiente ›
                      </button>
                    ) : (
                      <span className="rounded-cuaderno bg-pizarra/10 px-3 py-2 text-sm font-semibold text-pizarra">
                        Última ✓
                      </span>
                    )}
                  </div>
                </header>

                <ClaseContenido clase={claseActiva} />

                {actividadesDeClase.length > 0 && (
                  <div className="rounded-cuaderno border border-tinta/10 bg-tinta/[0.02] p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-tinta/80">
                      Actividades de esta clase
                    </p>
                    <ul className="space-y-2">
                      {actividadesDeClase.map(({ asignacion: a, entrega }) => {
                        const e = calcularEstado(a, entrega)
                        return (
                          <li key={a.id}>
                            <Link
                              to={`/estudiante/asignaciones/${a.id}`}
                              className="group flex items-center gap-3 rounded-cuaderno border border-tinta/10 bg-papel px-3 py-3 shadow-sm transition-colors hover:border-pizarra/40"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pizarra/10 text-pizarra">
                                📝
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="break-words font-semibold text-tinta">
                                  {a.titulo}
                                </p>
                                <p className="break-words text-sm text-tinta/65">
                                  {etiquetaPeriodo(a.periodo)} · {a.puntos} pts
                                  {a.fecha_limite &&
                                    ` · Entrega ${formatearFecha(a.fecha_limite, false)}`}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-medium ${TONO_BADGE[e.tono]}`}
                              >
                                {e.etiqueta}
                              </span>
                              <span
                                className="shrink-0 text-lg text-tinta/30 transition-transform group-hover:translate-x-0.5 group-hover:text-pizarra"
                                aria-hidden="true"
                              >
                                ›
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

              </article>
            )}
          </div>
        ))}
    </>
  )

  return (
    <Layout
      ancho="amplio"
      titulo={[tituloGrupo, ...chipsGrupo].join(' · ')}
      volver={<Volver to="/estudiante">Mi cuaderno</Volver>}
    >
      {/* En escritorio el encabezado vive en la barra fija (ver Layout); acá
          solo se muestra en celular, donde la barra no da para más. */}
      <div className="mb-3 border-b border-tinta/10 pb-2.5 lg:hidden">
        <Volver to="/estudiante">Mi cuaderno</Volver>
        <h1 className="mt-1 min-w-0 break-words text-lg font-bold leading-snug text-tinta">
          {[tituloGrupo, ...chipsGrupo].join(' · ')}
        </h1>
      </div>

      <h1 className="sr-only hidden lg:block">
        {[tituloGrupo, ...chipsGrupo].join(' · ')}
      </h1>

      {/* Navegación: pastillas (todas visibles) en móvil, barra lateral en escritorio. */}
      <div className="lg:hidden">
        <Tabs tabs={TABS} value={vista} onChange={cambiarVista} orientacion="menu" />
      </div>

      <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-7">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <Tabs
              tabs={TABS}
              value={vista}
              onChange={cambiarVista}
              orientacion="vertical"
            />
          </div>
        </aside>
        <div className="min-w-0">{panel}</div>
      </div>
    </Layout>
  )
}

// Columna de dato (etiqueta arriba, valor abajo) para las filas de asignación.
// `destacado` resalta el valor (se usa para el % que vale la asignación).
const TABS = [
  { id: 'clases', label: 'Clases', icon: '🎬' },
  { id: 'evaluacion', label: 'Evaluación', icon: '📊' },
]
