# Keep-alive de Supabase (PuraNota).
# Hace una consulta minima al API REST para que el proyecto del plan gratuito
# no se pause por inactividad. Lee la URL y la anon key de frontend/.env.
# Lo dispara una tarea programada de Windows (ver scripts/README-keep-alive.txt).

$ErrorActionPreference = 'Stop'
$envPath = 'C:\puranota\frontend\.env'
$logPath = 'C:\puranota\scripts\keep-alive.log'
$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')

$url = $null
$key = $null
foreach ($line in Get-Content $envPath) {
  if ($line -match '^\s*VITE_SUPABASE_URL\s*=\s*(.+?)\s*$') { $url = $Matches[1].Trim() }
  if ($line -match '^\s*VITE_SUPABASE_ANON_KEY\s*=\s*(.+?)\s*$') { $key = $Matches[1].Trim() }
}

if (-not $url -or -not $key) {
  Add-Content $logPath "$stamp ERROR: no se encontro VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en $envPath"
  exit 1
}

$headers = @{ apikey = $key; Authorization = "Bearer $key" }
try {
  $resp = Invoke-WebRequest -Uri "$url/rest/v1/grupos?select=id&limit=1" -Headers $headers -Method Get -TimeoutSec 30 -UseBasicParsing
  Add-Content $logPath "$stamp OK HTTP $($resp.StatusCode) - proyecto activo"
} catch {
  # Un 4xx igual cuenta como actividad (el proyecto respondio); solo un fallo de
  # red/DNS (proyecto pausado o sin internet) es problema.
  $code = $null
  try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
  if ($code) {
    Add-Content $logPath "$stamp OK HTTP $code - proyecto respondio (cuenta como actividad)"
  } else {
    Add-Content $logPath "$stamp SIN RESPUESTA - $($_.Exception.Message) (proyecto pausado o sin internet)"
  }
}
