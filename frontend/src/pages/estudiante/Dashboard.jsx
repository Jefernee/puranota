import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import Alerta from '../../components/Alerta'
import SkeletonLista from '../../components/SkeletonLista'
import { formatearFecha, textoVencimiento } from '../../lib/formato'
import { calcularEstado, TONO_BADGE } from '../../lib/entregas'
import { listarMisGrupos, unirseConCodigo } from '../../services/grupos.service'
import { listarAsignacionesDeGrupos } from '../../services/asignaciones.service'
import { listarMisEntregas } from '../../services/entregas.service'
import { listarAnunciosEstudiante } from '../../services/anuncios.service'

export default function DashboardEstudiante() {
  const { usuario, perfil } = useAuth()
  const [grupos, setGrupos] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [anuncios, setAnuncios] = useState([])

  // Formulario de unirse
  const [codigo, setCodigo] = useState('')
  const [uniendo, setUniendo] = useState(false)
  const [mensajeUnir, setMensajeUnir] = useState(null) // {tipo, texto}

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const mis = await listarMisGrupos(usuario.id)
      setGrupos(mis)

      const idsActivos = mis
        .filter((g) => g.estado === 'activo' && g.grupo)
        .map((g) => g.grupo.id)
      const asigs = await listarAsignacionesDeGrupos(idsActivos)
      const entregas = await listarMisEntregas(
        usuario.id,
        asigs.map((a) => a.id),
      )
      const porAsig = new Map(entregas.map((e) => [e.asignacion_id, e]))

      // Próximas: las que aún están pendientes (sin entregar) y no cerradas.
      const prox = asigs
        .map((a) => ({ asignacion: a, entrega: porAsig.get(a.id) || null }))
        .filter(({ asignacion, entrega }) => {
          const est = calcularEstado(asignacion, entrega)
          return est.clave === 'pendiente' || est.clave === 'pendiente_tardia'
        })
      // Más urgente primero (fecha límite más cercana); sin fecha, al final.
      prox.sort((x, y) => {
        const fx = x.asignacion.fecha_limite
        const fy = y.asignacion.fecha_limite
        if (!fx) return 1
        if (!fy) return -1
        return fx < fy ? -1 : fx > fy ? 1 : 0
      })
      setPendientes(prox)

      // Avisos del docente. No bloquea el dashboard si la tabla aún no existe.
      try {
        setAnuncios(await listarAnunciosEstudiante())
      } catch {
        setAnuncios([])
      }
    } catch (e) {
      setError(e?.message || 'No se pudo cargar tu información.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id])

  async function handleUnir(e) {
    e.preventDefault()
    setMensajeUnir(null)
    const limpio = codigo.trim().toUpperCase()
    if (limpio.length < 4) {
      setMensajeUnir({ tipo: 'error', texto: 'Escribí el código que te dio tu profe.' })
      return
    }
    setUniendo(true)
    try {
      const res = await unirseConCodigo(limpio)
      if (!res?.ok) {
        setMensajeUnir({ tipo: 'error', texto: res?.mensaje || 'Código inválido.' })
      } else {
        const espera =
          res.estado === 'pendiente'
            ? ' Tu profe debe aprobarte antes de que puedas entregar.'
            : ''
        setMensajeUnir({
          tipo: 'exito',
          texto: `¡Listo! Te uniste a "${res.grupo}".${espera}`,
        })
        setCodigo('')
        cargar()
      }
    } catch (err) {
      setMensajeUnir({
        tipo: 'error',
        texto: err?.message || 'No se pudo unir al grupo.',
      })
    } finally {
      setUniendo(false)
    }
  }

  const hoy = new Date().toISOString().slice(0, 10)

  const nombreGrupoEst = (id) =>
    grupos.find((g) => g.grupo?.id === id)?.grupo?.nombre
  const avisoGrupoTexto = (a) =>
    (a.grupo_ids || []).map(nombreGrupoEst).filter(Boolean).join(', ')

  return (
    <Layout>
      {/* Bienvenida */}
      <div className="mb-6 border-b border-tinta/10 pb-5">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          ¡Hola, {perfil?.nombre?.split(' ')[0] || 'estudiante'}!
        </h1>
        <p className="mt-0.5 text-tinta/60">Este es tu cuaderno.</p>
      </div>

      {error && (
        <div className="mb-4">
          <Alerta tipo="error">{error}</Alerta>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Contenido principal */}
        <div className="space-y-8">
          {/* Próximas entregas */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-tinta">
              Próximas entregas
              {!cargando && pendientes.length > 0 && (
                <span className="ml-2 text-sm font-medium text-tinta/55">
                  {pendientes.length}
                </span>
              )}
            </h2>
            {cargando ? (
              <SkeletonLista filas={2} altura="h-16" />
            ) : pendientes.length === 0 ? (
              <div className="rounded-cuaderno border border-pizarra/20 bg-pizarra/5 px-5 py-8 text-center">
                <p className="text-3xl">✓</p>
                <p className="mt-1 font-display text-lg font-bold text-pizarra">
                  ¡Vas al día!
                </p>
                <p className="text-sm text-tinta/65">
                  No tenés entregas pendientes.
                </p>
              </div>
            ) : (
              <ul className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                {pendientes.map(({ asignacion: a, entrega }) => {
                  const est = calcularEstado(a, entrega)
                  const vencida = a.fecha_limite && a.fecha_limite < hoy
                  return (
                    <li key={a.id}>
                      <Link
                        to={`/estudiante/asignaciones/${a.id}`}
                        className="group flex items-center gap-4 rounded-cuaderno border border-tinta/10 bg-superficie px-4 py-3.5 shadow-sm transition-colors hover:border-pizarra/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-tinta">
                            {a.titulo}
                          </p>
                          <p className="truncate text-sm text-tinta/65">
                            {a.grupo?.nombre}
                          </p>
                        </div>
                        <span
                          className={`hidden shrink-0 text-sm sm:block ${
                            vencida ? 'font-semibold text-margen' : 'text-tinta/60'
                          }`}
                        >
                          {a.fecha_limite
                            ? textoVencimiento(a.fecha_limite)
                            : 'Sin fecha'}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-medium ${TONO_BADGE[est.tono]}`}
                        >
                          {est.etiqueta}
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
            )}
          </section>

          {/* Mis grupos */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-tinta">
              Mis grupos
              {!cargando && grupos.length > 0 && (
                <span className="ml-2 text-sm font-medium text-tinta/55">
                  {grupos.length}
                </span>
              )}
            </h2>
            {cargando ? (
              <SkeletonLista filas={2} altura="h-20" />
            ) : grupos.length === 0 ? (
              <div className="rounded-cuaderno border border-tinta/10 bg-superficie px-5 py-8 text-center shadow-sm">
                <p className="text-3xl">📚</p>
                <p className="mt-1 font-display text-lg font-bold text-tinta">
                  Todavía no estás en ningún grupo
                </p>
                <p className="text-sm text-tinta/65">
                  Unite con el código que te da tu profe (panel de la derecha).
                </p>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {grupos.map((g) => (
                  <li key={g.id}>
                    {g.estado === 'activo' ? (
                      <Link
                        to={`/estudiante/grupos/${g.grupo.id}`}
                        className="tarjeta-cuaderno group block h-full px-5 py-4 pl-7 transition-shadow hover:shadow-md"
                      >
                        <GrupoContenido g={g} />
                      </Link>
                    ) : (
                      <div className="tarjeta-cuaderno block h-full px-5 py-4 pl-7 opacity-75">
                        <GrupoContenido g={g} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Columna derecha: avisos + unirse a un grupo */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          {/* Avisos del docente (cuadrito siempre visible) */}
          <div className="tarjeta-cuaderno px-5 py-5 pl-7">
            <p className="mb-2 flex items-center gap-1.5 font-display text-base font-semibold text-tinta">
              <span aria-hidden="true">📢</span> Avisos
              {anuncios.length > 0 && (
                <span className="text-sm font-medium text-tinta/55">
                  {anuncios.length}
                </span>
              )}
            </p>
            {cargando ? (
              <p className="text-sm text-tinta/60">Cargando…</p>
            ) : anuncios.length === 0 ? (
              <p className="text-sm text-tinta/65">No hay avisos por ahora.</p>
            ) : (
              <ul className="space-y-3">
                {anuncios.map((a) => {
                  const grupoTxt = avisoGrupoTexto(a)
                  return (
                    <li key={a.id} className="border-l-2 border-guaria/50 pl-3">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold uppercase tracking-wide text-guaria">
                          {grupoTxt || 'Aviso'}
                        </span>
                        <span className="text-sm text-tinta/60">
                          {formatearFecha(a.creado_en, false)}
                        </span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-tinta/90">
                        {a.contenido}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="tarjeta-cuaderno px-5 py-4 pl-7">
            <p className="mb-2 font-display text-sm font-semibold text-tinta">
              Unirme a un grupo
            </p>
            <form onSubmit={handleUnir} className="space-y-2">
              <input
                className="campo w-full text-center font-mono uppercase tracking-[0.2em]"
                placeholder="Código"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                aria-label="Código del grupo"
              />
              <button className="btn-primario w-full" disabled={uniendo}>
                {uniendo ? 'Uniéndote…' : 'Unirme'}
              </button>
            </form>
            {mensajeUnir && (
              <div className="mt-2">
                <Alerta tipo={mensajeUnir.tipo}>{mensajeUnir.texto}</Alerta>
              </div>
            )}
          </div>
        </aside>
      </div>
    </Layout>
  )
}

function GrupoContenido({ g }) {
  // Si está pendiente, RLS oculta los datos del grupo (grupo viene null).
  const pendiente = g.estado === 'pendiente'
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-tinta">
          {g.grupo?.nombre || (pendiente ? 'Grupo en revisión' : 'Grupo')}
        </p>
        {pendiente ? (
          <span className="shrink-0 rounded-full bg-margen/10 px-2 py-0.5 text-sm font-medium text-margen">
            Pendiente
          </span>
        ) : (
          <span
            className="shrink-0 text-lg text-tinta/30 transition-transform group-hover:translate-x-0.5 group-hover:text-pizarra"
            aria-hidden="true"
          >
            ›
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-tinta/65">
        {pendiente
          ? 'Tu profe debe aprobarte para que puedas entregar.'
          : [g.grupo?.materia, g.grupo?.especialidad, g.grupo?.nivel]
              .filter(Boolean)
              .join(' · ') || 'Sin materia'}
      </p>
    </>
  )
}
