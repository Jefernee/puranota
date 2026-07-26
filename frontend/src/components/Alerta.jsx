// Mensaje de error / éxito / info / advertencia, accesible (role apropiado).
//
// Sobrio a propósito: una franja de color al costado y el texto en tinta, en
// vez de un recuadro entero teñido. El color señala el tipo sin gritar, y el
// texto se lee igual de bien en modo claro y oscuro.

export default function Alerta({ tipo = 'error', children }) {
  if (!children) return null

  const franja = {
    error: 'border-l-margen',
    exito: 'border-l-pizarra',
    info: 'border-l-tinta/35',
    advertencia: 'border-l-ambar',
  }

  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`rounded-cuaderno border border-tinta/12 border-l-4 bg-superficie px-4 py-3 text-[15px] leading-relaxed text-tinta/85 shadow-sm ${
        franja[tipo] || franja.error
      }`}
    >
      {children}
    </div>
  )
}
