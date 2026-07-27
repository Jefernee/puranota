// Distintivo de ambiente. Existe por un problema concreto: `localhost:5173` y
// `puranota.pages.dev` se ven idénticos, y hoy AMBOS escriben en la misma base.
// Sin esto no hay forma de saber si lo que estás borrando es de verdad.
//
// Qué muestra, y por qué así:
//   - Solo aparece cuando corrés en local (`npm run dev`). El sitio publicado
//     queda limpio: ahí no hay ambigüedad posible.
//   - El color informa (regla §5.5.3): rojo si la base es la de producción
//     —estás tocando datos reales—, ámbar si es una base de pruebas.
//
// El ambiente de la BASE se declara en `frontend/.env` con:
//     VITE_AMBIENTE=staging
// Si no está declarado se asume producción, que es la advertencia prudente:
// más vale avisar de más que dejar borrar datos reales creyendo que son falsos.

const ES_LOCAL = import.meta.env.DEV
const ES_PRUEBAS = import.meta.env.VITE_AMBIENTE === 'staging'

/** Host de la base, para saber de un vistazo a cuál apunta. */
function hostDeLaBase() {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL).hostname
  } catch {
    return 'sin configurar'
  }
}

export default function Ambiente() {
  if (!ES_LOCAL) return null

  const tono = ES_PRUEBAS
    ? 'bg-ambar/15 text-ambar ring-ambar/30'
    : 'bg-margen/15 text-margen ring-margen/30'

  return (
    <span
      className={`hidden shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold uppercase tracking-wide ring-1 ring-inset sm:inline ${tono}`}
      title={`Estás en tu computadora (npm run dev). Base de datos: ${hostDeLaBase()}`}
    >
      Local · {ES_PRUEBAS ? 'datos de prueba' : 'datos reales'}
    </span>
  )
}
