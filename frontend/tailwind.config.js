/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Identidad "cuaderno escolar costarricense".
        // Los valores viven como variables CSS en index.css (canales RGB), para
        // poder intercambiar toda la paleta entre modo claro y oscuro con un
        // atributo data-theme en <html>. <alpha-value> conserva los /opacidad.
        papel: 'rgb(var(--c-papel) / <alpha-value>)', // fondo de página
        tinta: 'rgb(var(--c-tinta) / <alpha-value>)', // texto / tinta
        superficie: 'rgb(var(--c-superficie) / <alpha-value>)', // tarjetas, inputs
        pizarra: 'rgb(var(--c-pizarra) / <alpha-value>)', // primario "verde pizarra"
        guaria: 'rgb(var(--c-guaria) / <alpha-value>)', // acento "guaria morada"
        margen: 'rgb(var(--c-margen) / <alpha-value>)', // margen "rojo cuaderno"
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        cuaderno: '12px',
      },
    },
  },
  plugins: [],
}
