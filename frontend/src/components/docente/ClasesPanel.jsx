import { useEffect, useState } from 'react'
import Modal from '../Modal'
import Alerta from '../Alerta'
import EstadoVacio from '../EstadoVacio'
import SkeletonLista from '../SkeletonLista'
import ClaseForm from './ClaseForm'
import ClaseContenido from '../ClaseContenido'
import MenuAcciones from '../MenuAcciones'
import Volver from '../Volver'
import { subirArchivos, subirVideo } from '../../services/storage.service'
import {
  listarClases,
  crearClase,
  actualizarClase,
  cambiarVisibilidadClase,
  eliminarClase,
  agregarArchivosClase,
  eliminarArchivoClase,
} from '../../services/clases.service'

// Panel de clases dentro del detalle de un grupo. Props: grupoId.
export default function ClasesPanel({ grupoId }) {
  const [clases, setClases] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [verClase, setVerClase] = useState(null)
  const [aBorrar, setABorrar] = useState(null)
  const [borrando, setBorrando] = useState(false)

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      setClases(await listarClases(grupoId))
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar las clases.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId])

  function abrirCrear() {
    setEditando(null)
    setFormAbierto(true)
  }
  function abrirEditar(c) {
    setEditando(c)
    setFormAbierto(true)
  }

  async function handleGuardar(datos, archivosNuevos, videosNuevos, onVideoProgress) {
    let clase
    if (editando) {
      clase = await actualizarClase(editando.id, datos)
    } else {
      // Las clases nuevas se numeran solas: van al final (mayor orden + 1).
      const siguienteOrden =
        clases.reduce((m, c) => Math.max(m, c.orden ?? 0), 0) + 1
      clase = await crearClase(grupoId, { ...datos, orden: siguienteOrden })
    }

    // Fotos/PDF y el video propio se guardan como clase_archivos (el video
    // lleva tipo video/* y se reproduce con <video> en ClaseContenido).
    const subidos = []
    if (archivosNuevos?.length)
      subidos.push(...(await subirArchivos(archivosNuevos, 'clases', grupoId)))
    for (const v of videosNuevos || []) {
      subidos.push(await subirVideo(v, onVideoProgress, grupoId))
    }
    if (subidos.length) await agregarArchivosClase(clase.id, subidos)

    // Recargar la lista y, si estábamos VIENDO esta clase, refrescar el detalle
    // para que los archivos recién agregados aparezcan (si no, parece que "no se
    // agregó").
    const lista = await listarClases(grupoId)
    setClases(lista)
    if (verClase && verClase.id === clase.id) {
      setVerClase(lista.find((c) => c.id === clase.id) || null)
    }
    // Al crear se cierra (aparece en la lista). Al editar, el form queda abierto
    // mostrando "guardado ✓" ADENTRO (no un aviso por fuera).
    if (!editando) {
      setFormAbierto(false)
      setEditando(null)
    }
  }

  // Quitar un archivo existente desde el formulario de edición.
  async function handleQuitarArchivo(archivoId) {
    await eliminarArchivoClase(archivoId)
    // Refleja el cambio en la clase que se está editando y en la lista.
    setEditando((prev) =>
      prev
        ? { ...prev, archivos: (prev.archivos || []).filter((a) => a.id !== archivoId) }
        : prev,
    )
    setClases((prev) =>
      prev.map((c) =>
        c.id === editando?.id
          ? { ...c, archivos: (c.archivos || []).filter((a) => a.id !== archivoId) }
          : c,
      ),
    )
  }

  async function toggleVisibilidad(c) {
    try {
      const act = await cambiarVisibilidadClase(c.id, !c.visible)
      setClases((prev) => prev.map((x) => (x.id === act.id ? act : x)))
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar la visibilidad.')
    }
  }

  async function confirmarBorrar() {
    setBorrando(true)
    setError('')
    try {
      await eliminarClase(aBorrar.id)
      setClases((prev) => prev.filter((c) => c.id !== aBorrar.id))
      setABorrar(null)
    } catch (e) {
      setError(e?.message || 'No se pudo eliminar la clase.')
    } finally {
      setBorrando(false)
    }
  }

  return (
    <div className="space-y-4">
      {verClase ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-tinta/10 pb-3">
            <div className="flex min-w-0 items-center gap-3">
              <Volver onClick={() => setVerClase(null)}>Clases</Volver>
              <h2 className="min-w-0 break-words text-xl font-bold text-tinta sm:text-2xl">
                {verClase.titulo}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => abrirEditar(verClase)}
              className="btn-secundario shrink-0"
            >
              Editar
            </button>
          </div>
          <ClaseContenido clase={verClase} compacto />
        </>
      ) : (
      <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-tinta">
          Clases
          {clases.length > 0 && (
            <span className="ml-2 text-sm font-medium text-tinta/55">
              {clases.length}
            </span>
          )}
        </h3>
        <button className="btn-primario" onClick={abrirCrear}>
          + Nueva clase
        </button>
      </div>

      <Alerta tipo="error">{error}</Alerta>

      {cargando ? (
        <SkeletonLista />
      ) : clases.length === 0 ? (
        <EstadoVacio icono="🎬" titulo="Aún no hay clases">
          Creá la primera con texto, un video de YouTube o material adjunto.
        </EstadoVacio>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {clases.map((c) => {
            const nVideosPropios = (c.archivos || []).filter((a) =>
              a.tipo?.startsWith('video/'),
            ).length
            const nYoutube =
              Array.isArray(c.youtube_urls) && c.youtube_urls.length
                ? c.youtube_urls.length
                : c.youtube_url
                  ? 1
                  : 0
            const nVideos = nVideosPropios + nYoutube
            const nAdjuntos = (c.archivos || []).filter(
              (a) => !a.tipo?.startsWith('video/'),
            ).length
            return (
            <li
              key={c.id}
              onClick={() => setVerClase(c)}
              className="tarjeta-cuaderno cursor-pointer px-4 py-4 sm:px-5 sm:pl-7 transition-shadow hover:shadow-md"
              title="Abrir la clase"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-tinta">{c.titulo}</h3>
                    {!c.visible && (
                      <span className="rounded-full bg-tinta/10 px-2 py-0.5 text-sm text-tinta/60">
                        Oculta
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-tinta/65">
                    {[
                      nVideos > 0 && `🎬 ${nVideos} video${nVideos === 1 ? '' : 's'}`,
                      nAdjuntos > 0 &&
                        `📎 ${nAdjuntos} archivo${nAdjuntos === 1 ? '' : 's'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Solo texto'}
                  </p>
                  {c.contenido && (
                    <p className="mt-1 line-clamp-1 text-sm text-tinta/60">
                      {sinMarkdown(c.contenido)}
                    </p>
                  )}
                </div>
                <MenuAcciones
                  items={[
                    {
                      label: c.visible ? 'Ocultar' : 'Mostrar',
                      onClick: () => toggleVisibilidad(c),
                      icon: c.visible ? 'ocultar' : 'mostrar',
                    },
                    { label: 'Editar', onClick: () => abrirEditar(c), icon: 'editar' },
                    {
                      label: 'Eliminar',
                      onClick: () => setABorrar(c),
                      tono: 'margen',
                      icon: 'eliminar',
                    },
                  ]}
                />
              </div>
            </li>
            )
          })}
        </ul>
      )}
      </>
      )}

      {/* Crear / editar */}
      <Modal
        abierto={formAbierto}
        onCerrar={() => {
          setFormAbierto(false)
          setEditando(null)
        }}
        titulo={editando ? 'Editar clase' : 'Nueva clase'}
        size="ancho"
      >
        <ClaseForm
          inicial={editando || {}}
          onGuardar={handleGuardar}
          onCancelar={() => {
            setFormAbierto(false)
            setEditando(null)
          }}
          onQuitarArchivo={handleQuitarArchivo}
          textoBoton={editando ? 'Guardar cambios' : 'Crear clase'}
        />
      </Modal>

      {/* Eliminar */}
      <Modal abierto={!!aBorrar} onCerrar={() => setABorrar(null)} titulo="Eliminar clase">
        <p className="text-sm text-tinta/80">
          ¿Seguro que querés eliminar <strong>{aBorrar?.titulo}</strong>? Se borrará
          su contenido y los adjuntos. Esta acción no se puede deshacer.
        </p>
        <Alerta tipo="error">{error}</Alerta>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="btn-secundario"
            onClick={() => setABorrar(null)}
            disabled={borrando}
          >
            Cancelar
          </button>
          <button
            className="btn-primario !bg-margen hover:!bg-margen/90"
            onClick={confirmarBorrar}
            disabled={borrando}
          >
            {borrando ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// Quita la sintaxis markdown básica para mostrar un preview en texto plano.
function sinMarkdown(txt) {
  return (txt || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // enlaces → solo el texto
    .replace(/[*_`~]/g, '') // énfasis / código
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // encabezados
    .replace(/^\s{0,3}[-*+]\s+/gm, '') // viñetas
    .replace(/^\s{0,3}>\s?/gm, '') // citas
    .replace(/\s+/g, ' ')
    .trim()
}
