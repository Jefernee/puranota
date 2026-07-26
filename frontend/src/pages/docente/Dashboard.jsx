import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import Alerta from '../../components/Alerta'
import GrupoForm from '../../components/docente/GrupoForm'
import AvisosModal from '../../components/docente/AvisosModal'
import EstadoVacio from '../../components/EstadoVacio'
import SkeletonLista from '../../components/SkeletonLista'
import {
  listarGrupos,
  crearGrupo,
  guardarRubros,
  contarEstudiantesActivos,
} from '../../services/grupos.service'
import { contarPorRevisarPorGrupo } from '../../services/entregas.service'
import { cantidadPeriodos, periodosDeGrupo } from '../../lib/periodos'
import { rubrosCompletosDeModalidad } from '../../lib/mep'

export default function DashboardDocente() {
  const { usuario, perfil } = useAuth()
  const [grupos, setGrupos] = useState([])
  const [porRevisar, setPorRevisar] = useState({}) // { grupoId: cantidad sin calificar }
  const [totalEstudiantes, setTotalEstudiantes] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [crear, setCrear] = useState(false)
  const [avisos, setAvisos] = useState(false)

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const gs = await listarGrupos(usuario.id)
      setGrupos(gs)
      const ids = gs.map((g) => g.id)
      const [pr, est] = await Promise.all([
        contarPorRevisarPorGrupo().catch(() => ({})),
        contarEstudiantesActivos(ids).catch(() => 0),
      ])
      setPorRevisar(pr)
      setTotalEstudiantes(est)
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar tus grupos.')
    } finally {
      setCargando(false)
    }
  }

  const totalPorRevisar = Object.values(porRevisar).reduce((a, b) => a + b, 0)

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCrear(datos) {
    const grupo = await crearGrupo(usuario.id, datos)
    // Modo MEP: dejar los rubros oficiales cargados solos en todos los periodos,
    // así el docente no tiene que hacer ningún paso extra. Si falla, no bloquea
    // la creación (siempre puede cargarlos a mano en la pestaña Rubros).
    if (grupo?.mep_modalidad) {
      try {
        const rubros = rubrosCompletosDeModalidad(
          grupo.mep_modalidad,
          periodosDeGrupo(grupo),
        )
        if (rubros) await guardarRubros(grupo.id, rubros)
      } catch (e) {
        console.error('No se pudieron pre-cargar los rubros del MEP:', e)
      }
    }
    setCrear(false)
    await cargar()
  }

  return (
    <Layout>
      {/* Saludo + resumen + acción en una sola fila (aprovecha el ancho) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-tinta/10 pb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            ¡Hola, {perfil?.nombre?.split(' ')[0] || 'profe'}!
          </h1>
          <p className="mt-0.5 text-tinta/60">Estos son tus grupos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!cargando && grupos.length > 0 && (
            <>
              <ResumenPill valor={totalEstudiantes} label="estudiantes" />
              {totalPorRevisar > 0 && (
                <ResumenPill valor={totalPorRevisar} label="por revisar" alerta />
              )}
            </>
          )}
          <button
            type="button"
            className="btn-secundario"
            onClick={() => setAvisos(true)}
          >
            📢 Avisos
          </button>
          <button className="btn-primario" onClick={() => setCrear(true)}>
            + Nuevo grupo
          </button>
        </div>
      </div>

      <Alerta tipo="error">{error}</Alerta>

      {cargando ? (
        <SkeletonLista filas={4} altura="h-28" />
      ) : grupos.length === 0 ? (
        <EstadoVacio icono="📚" titulo="Todavía no tenés grupos">
          <span className="mt-3 block">
            <button className="btn-primario" onClick={() => setCrear(true)}>
              Crear mi primer grupo
            </button>
          </span>
        </EstadoVacio>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {grupos.map((g) => (
            <li key={g.id}>
              <Link
                to={`/docente/grupos/${g.id}`}
                className="tarjeta-cuaderno block px-4 py-4 sm:px-5 sm:pl-7 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold leading-tight">{g.nombre}</h2>
                  {!g.activo && (
                    <span className="shrink-0 rounded-full bg-tinta/10 px-2 py-0.5 text-sm text-tinta/60">
                      Inactivo
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-tinta/60">
                  {[g.materia, g.especialidad, g.nivel].filter(Boolean).join(' · ') ||
                    'Sin materia'}
                </p>
                {porRevisar[g.id] > 0 && (
                  <span className="mt-2 inline-block rounded-full bg-margen/10 px-2.5 py-0.5 text-sm font-semibold text-margen">
                    {porRevisar[g.id]} por revisar
                  </span>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-tinta/60">
                    {g.anio} · {cantidadPeriodos(g)} periodos
                  </span>
                  <span className="rounded bg-tinta/5 px-2 py-1 font-mono text-sm font-bold tracking-widest text-tinta">
                    {g.codigo_acceso}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal
        abierto={crear}
        onCerrar={() => setCrear(false)}
        titulo="Nuevo grupo"
        size="ancho"
      >
        <GrupoForm
          onGuardar={handleCrear}
          onCancelar={() => setCrear(false)}
          textoBoton="Crear grupo"
        />
      </Modal>

      <AvisosModal
        abierto={avisos}
        onCerrar={() => setAvisos(false)}
        docenteId={usuario.id}
        grupos={grupos}
      />
    </Layout>
  )
}

// Píldora compacta de resumen, al lado del saludo (número + etiqueta).
function ResumenPill({ valor, label, alerta = false }) {
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-full border px-3.5 py-1.5 ${
        alerta ? 'border-margen/30 bg-margen/5' : 'border-tinta/15 bg-superficie'
      }`}
    >
      <span
        className={`font-display text-lg font-bold leading-none tabular-nums ${
          alerta ? 'text-margen' : 'text-tinta'
        }`}
      >
        {valor}
      </span>
      <span className="text-sm text-tinta/60">{label}</span>
    </span>
  )
}
