# Despliegue en Cloudflare Pages

Publicar temprano y **oculto para los buscadores** (decisión D15 en
[`PLAN.md`](./PLAN.md)). El objetivo es tener una dirección web real para probar
en el celular y que cada cambio subido a GitHub se publique solo.

---

## 1. Conectar el repositorio (una sola vez)

En el panel de Cloudflare — la misma cuenta donde ya está el bucket R2:

1. **Workers & Pages → Create → Pages → Connect to Git**
2. Autorizá GitHub y elegí el repositorio **`Jefernee/puranota`**
3. Configuración de compilación:

| Campo | Valor |
|---|---|
| Framework preset | `Vite` |
| **Root directory** | `frontend` ← **importante**, el proyecto no está en la raíz |
| Build command | `npm run build` |
| Build output directory | `dist` |

4. **Environment variables** → agregá las dos, para *Production* y *Preview*:

```
VITE_SUPABASE_URL       https://<TU-PROJECT-REF>.supabase.co
VITE_SUPABASE_ANON_KEY  <la anon key>
```

> Sin estas dos variables el sitio compila pero muestra la pantalla de error de
> configuración: Vite las incrusta **en tiempo de compilación**, no las lee al
> ejecutarse. Si las agregás después, hay que volver a desplegar.

5. **Save and Deploy.** Queda en `https://puranota.pages.dev`.

De ahí en adelante, cada `git push` a `main` publica solo.

---

## 2. Dos cosas que rompen en producción si se olvidan

Las dos fallan **solo en el dominio nuevo**, así que en `localhost` todo parece
bien y uno se entera tarde.

### CORS de Cloudflare R2

Sin esto, subir una foto o un PDF falla en producción. En el bucket → **Settings
→ CORS Policy**, agregá el origen nuevo junto al de desarrollo:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://puranota.pages.dev"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### URLs de autenticación en Supabase

Sin esto, el correo de recuperación de contraseña manda al estudiante a
`localhost` y no funciona. En Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://puranota.pages.dev`
- **Redirect URLs:** agregá `https://puranota.pages.dev/restablecer`
  (dejá también los de `localhost` para poder seguir desarrollando)

---

## 3. Qué ya está resuelto en el repositorio

| Archivo | Para qué |
|---|---|
| `frontend/public/_redirects` | Enrutado de la aplicación. **Sin esto, recargar en `/estudiante/grupos/abc` da 404.** |
| `frontend/public/_headers` | `noindex`, cabeceras de seguridad y caché de los archivos compilados |
| `frontend/public/robots.txt` | Fuera de los buscadores hasta el bloque 2 |

---

## 4. Comprobar que quedó bien

1. Abrí `https://puranota.pages.dev` **en el celular**, no solo en la computadora.
2. Entrá como estudiante y andá a **Evaluación**.
3. **Recargá la página estando adentro de un grupo** — si da 404, `_redirects`
   no se aplicó.
4. Subí un archivo a una entrega: si falla, es el CORS de R2.
5. Probá "Olvidé mi contraseña": el correo debe llevar al dominio nuevo.

---

## 5. Dominio propio (opcional)

`pages.dev` funciona y se indexa. Uno propio da más confianza a los docentes.
Se agrega en **Pages → Custom domains** y no obliga a rehacer nada: si lo comprás
después, se cambia y listo. Al cambiarlo hay que actualizar el CORS de R2 y las
URLs de Supabase del punto 2.
