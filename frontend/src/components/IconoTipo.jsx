// Insignia del tipo de actividad para el registro de Evaluación.
//
// Antes se usaban caracteres tipográficos (▣ ◆ ≡). Se ven crudos y desalineados
// porque son glifos de la fuente, no íconos: cada uno tiene su propio peso y su
// propia caja. Acá son SVG de trazo dentro de un círculo sólido, todos del mismo
// tamaño óptico — que es como se ven los sistemas académicos formales.

const TRAZOS = {
  // Entrega: una hoja con la esquina doblada.
  entrega: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  // Prueba: tabla sujetapapeles.
  prueba: (
    <>
      <path d="M16 4h1a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1" />
      <rect x="9" y="2.5" width="6" height="3.5" rx="1" />
      <path d="M9 12.5l2 2 4-4" />
    </>
  ),
  // Proyecto: capas apiladas.
  proyecto: (
    <>
      <path d="m12 3 8 4.5-8 4.5-8-4.5z" />
      <path d="m4 12 8 4.5 8-4.5" />
      <path d="m4 16.5 8 4.5 8-4.5" />
    </>
  ),
  // Foro: globo de conversación.
  foro: (
    <>
      <path d="M20 14a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    </>
  ),
  // Asistencia: visto. No es una actividad, se calcula sola.
  asistencia: (
    <>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </>
  ),
}

// Tratamiento NEUTRO y uniforme. Un semáforo de colores en cada fila de un
// registro se ve decorativo, no formal: la diferencia entre tipos la hace la
// forma del ícono y la etiqueta que va debajo del título.
// La asistencia es la única distinta, porque no es una actividad entregable.
const FONDOS = {
  entrega: 'bg-tinta/[0.07] text-tinta/70 ring-1 ring-inset ring-tinta/12',
  prueba: 'bg-tinta/[0.07] text-tinta/70 ring-1 ring-inset ring-tinta/12',
  proyecto: 'bg-tinta/[0.07] text-tinta/70 ring-1 ring-inset ring-tinta/12',
  foro: 'bg-tinta/[0.07] text-tinta/70 ring-1 ring-inset ring-tinta/12',
  asistencia: 'bg-pizarra/10 text-pizarra ring-1 ring-inset ring-pizarra/20',
}

/**
 * @param clave  'entrega' | 'prueba' | 'proyecto' | 'foro' | 'asistencia'
 * @param label  texto para el tooltip (opcional)
 */
export default function IconoTipo({ clave = 'entrega', label }) {
  const trazo = TRAZOS[clave] || TRAZOS.entrega
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
        FONDOS[clave] || FONDOS.entrega
      }`}
      title={label}
      role="img"
      aria-label={label || clave}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[15px] w-[15px]"
        aria-hidden="true"
      >
        {trazo}
      </svg>
    </span>
  )
}
