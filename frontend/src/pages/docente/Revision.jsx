import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import Volver from '../../components/Volver'
import RevisionAsignacion from '../../components/docente/RevisionAsignacion'

// Ruta directa /docente/asignaciones/:id — reusa el componente de revisión.
// (En el grupo, la revisión se abre inline dentro de AsignacionesPanel.)
//
// En la barra superior va el CURSO, no la actividad: es el contexto que no
// cambia mientras uno navega, igual que en el resto de la aplicación. El nombre
// de la actividad lo pone el propio componente de revisión, abajo.
export default function Revision() {
  const { id } = useParams()
  const [grupo, setGrupo] = useState(null)

  const materia = grupo?.materia || grupo?.nombre || null
  const tituloCurso = materia
    ? [
        materia,
        ...[
          grupo.nombre !== materia ? grupo.nombre : null,
          grupo.especialidad,
          grupo.nivel,
        ].filter(Boolean),
      ].join(' · ')
    : undefined

  return (
    <Layout
      ancho="medio"
      titulo={tituloCurso}
      volver={
        grupo ? <Volver to={`/docente/grupos/${grupo.id}`}>Volver al grupo</Volver> : null
      }
    >
      <RevisionAsignacion
        asignacionId={id}
        onCargada={(a) => setGrupo(a?.grupo || null)}
      />
    </Layout>
  )
}
