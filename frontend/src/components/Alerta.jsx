// Mensaje de error / éxito / info en español, accesible (role apropiado).
export default function Alerta({ tipo = 'error', children }) {
  if (!children) return null

  const estilos = {
    error: 'border-margen/30 bg-margen/10 text-margen',
    exito: 'border-pizarra/30 bg-pizarra/10 text-pizarra',
    info: 'border-guaria/30 bg-guaria/10 text-guaria',
    advertencia: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  }

  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`rounded-cuaderno border px-3.5 py-2.5 text-sm ${estilos[tipo]}`}
    >
      {children}
    </div>
  )
}
