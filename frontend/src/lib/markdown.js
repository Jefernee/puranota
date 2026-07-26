// Markdown muy simple y seguro: escapa HTML primero y solo convierte un
// subconjunto (encabezados, negrita, itálica, enlaces, listas, párrafos).
// El contenido lo escribe el docente; igual escapamos para evitar inyección.

function escapar(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer" class="text-pizarra underline">$1</a>',
    )
}

/** Convierte markdown simple a HTML seguro (string). */
export function renderMarkdownSimple(texto) {
  if (!texto) return ''
  const lineas = escapar(texto).split(/\r?\n/)
  let html = ''
  let enLista = false

  const cerrarLista = () => {
    if (enLista) {
      html += '</ul>'
      enLista = false
    }
  }

  for (const linea of lineas) {
    if (/^\s*-\s+/.test(linea)) {
      if (!enLista) {
        html += '<ul class="list-disc pl-5 space-y-1">'
        enLista = true
      }
      html += `<li>${inline(linea.replace(/^\s*-\s+/, ''))}</li>`
      continue
    }
    cerrarLista()

    if (/^###\s+/.test(linea))
      html += `<h3 class="font-bold mt-3">${inline(linea.replace(/^###\s+/, ''))}</h3>`
    else if (/^##\s+/.test(linea))
      html += `<h2 class="font-bold text-lg mt-3">${inline(linea.replace(/^##\s+/, ''))}</h2>`
    else if (/^#\s+/.test(linea))
      html += `<h1 class="font-bold text-xl mt-3">${inline(linea.replace(/^#\s+/, ''))}</h1>`
    else if (linea.trim() === '') html += ''
    else html += `<p>${inline(linea)}</p>`
  }
  cerrarLista()
  return html
}
