import { useEffect, useState } from 'react'

// Herramienta de desarrollo. NO se incluye en el sitio publicado.
//
// Recorre la página buscando elementos más anchos que la pantalla —la causa de
// que algo "se salga" en celular— y muestra abajo cuáles son, con su etiqueta y
// sus clases. Así se puede señalar al culpable exacto sin adivinar ni depender
// de una captura.
//
// Se apaga tocando la barra.

/**
 * ¿El elemento vive dentro de algo que YA tiene su propio scroll horizontal?
 *
 * Una tabla ancha dentro de un contenedor con `overflow-x: auto` es lo correcto,
 * no un error: se desplaza sola y la página no se mueve. Sin esta comprobación
 * el detector señalaba las columnas del registro de notas como si fueran un
 * problema, y el aviso real se perdía entre el ruido.
 */
function dentroDeUnScroller(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const ov = getComputedStyle(p).overflowX
    if (ov === 'auto' || ov === 'scroll') return true
  }
  return false
}

function describir(el) {
  const tag = el.tagName.toLowerCase()
  const clases = (typeof el.className === 'string' ? el.className : '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ')
  const texto = (el.textContent || '').trim().slice(0, 28)
  return `${tag}${clases ? '.' + clases.replace(/ /g, '.') : ''}${
    texto ? ` — "${texto}"` : ''
  }`
}

export default function DetectorDesborde() {
  const [culpables, setCulpables] = useState([])
  const [oculto, setOculto] = useState(false)

  useEffect(() => {
    if (oculto) return
    let t
    const revisar = () => {
      const ancho = document.documentElement.clientWidth
      const encontrados = []
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        // Se ignora lo que no ocupa espacio y los desbordes de 1px por redondeo.
        if (r.width === 0 && r.height === 0) continue
        if (dentroDeUnScroller(el)) continue
        if (r.right > ancho + 1 || r.left < -1) {
          // Solo el elemento más profundo: si el padre también desborda, es
          // porque lo empuja el hijo.
          if (!encontrados.some((x) => x.el.contains(el))) {
            encontrados.push({ el, exceso: Math.round(r.right - ancho) })
          } else {
            const i = encontrados.findIndex((x) => x.el.contains(el))
            encontrados[i] = { el, exceso: Math.round(r.right - ancho) }
          }
        }
      }
      setCulpables(encontrados.slice(0, 4).map((x) => ({ ...x, txt: describir(x.el) })))
    }
    const programar = () => {
      clearTimeout(t)
      t = setTimeout(revisar, 350)
    }
    programar()
    window.addEventListener('resize', programar)
    const obs = new MutationObserver(programar)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', programar)
      obs.disconnect()
    }
  }, [oculto])

  if (oculto || culpables.length === 0) return null

  return (
    <div
      onClick={() => setOculto(true)}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: '#B3261E',
        color: '#fff',
        font: '12px/1.35 ui-monospace, Consolas, monospace',
        padding: '8px 10px',
        maxHeight: '38vh',
        overflowY: 'auto',
        cursor: 'pointer',
      }}
    >
      <b>Se sale de la pantalla ({culpables.length}) — tocá para cerrar</b>
      {culpables.map((c, i) => (
        <div key={i} style={{ marginTop: 5, wordBreak: 'break-all' }}>
          +{c.exceso}px → {c.txt}
        </div>
      ))}
    </div>
  )
}
