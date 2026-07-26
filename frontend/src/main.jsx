import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import DetectorDesborde from './components/DetectorDesborde.jsx'
import './index.css'

// El detector de desbordes solo existe mientras se desarrolla: Vite elimina
// este bloque del sitio publicado.
const enDesarrollo = import.meta.env.DEV

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {enDesarrollo && <DetectorDesborde />}
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
