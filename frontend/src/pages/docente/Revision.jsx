import { useParams } from 'react-router-dom'
import Layout from '../../components/Layout'
import RevisionAsignacion from '../../components/docente/RevisionAsignacion'

// Ruta directa /docente/asignaciones/:id — reusa el componente de revisión.
// (En el grupo, la revisión se abre inline dentro de AsignacionesPanel.)
export default function Revision() {
  const { id } = useParams()
  return (
    <Layout ancho="medio">
      <RevisionAsignacion asignacionId={id} />
    </Layout>
  )
}
