import { createClient } from '@supabase/supabase-js'

// Único lugar de toda la app donde se crea el cliente de Supabase.
// Ningún componente debe importar esto directamente: usar src/services/.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Falla temprano y claro en desarrollo si falta configuración.
  console.error(
    'Faltan variables de entorno de Supabase. Revisá frontend/.env ' +
      '(VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
