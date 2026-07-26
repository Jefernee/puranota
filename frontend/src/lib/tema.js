// Tema claro/oscuro. La paleta vive en variables CSS (index.css); acá solo
// alternamos el atributo data-theme en <html> y guardamos la preferencia.
// El modo oscuro es el predeterminado (ver el script en index.html).

const CLAVE = 'pn-tema'

/** 'dark' | 'light' según el estado actual del documento. */
export function temaActual() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light'
}

/** Aplica un tema y lo persiste. */
export function aplicarTema(tema) {
  const oscuro = tema === 'dark'
  if (oscuro) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  try {
    localStorage.setItem(CLAVE, oscuro ? 'dark' : 'light')
  } catch {
    /* almacenamiento no disponible: el tema igual queda aplicado en memoria */
  }
}

/** Alterna claro↔oscuro y devuelve el tema resultante. */
export function alternarTema() {
  const nuevo = temaActual() === 'dark' ? 'light' : 'dark'
  aplicarTema(nuevo)
  return nuevo
}
