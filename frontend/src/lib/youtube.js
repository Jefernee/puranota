// Extrae el ID de un video de YouTube de las formas más comunes de URL:
// youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID.
export function youtubeId(url) {
  if (!url) return null
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/,
  )
  return m ? m[1] : null
}

/** URL de embed lista para el iframe (o null si la URL no es válida). */
export function youtubeEmbed(url) {
  const id = youtubeId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}
