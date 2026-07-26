KEEP-ALIVE DE SUPABASE (PuraNota)
=================================

Qué es:
  Una tarea programada de Windows ("PuraNota-KeepAlive") que corre a diario el
  script keep-alive-supabase.ps1, el cual le hace una consulta mínima al API REST
  de Supabase para que el proyecto (plan gratuito) no se pause por inactividad.

Archivos:
  - keep-alive-supabase.ps1  -> el ping (lee URL y anon key de frontend/.env)
  - keep-alive.log           -> registro de cada corrida (OK / sin respuesta)

Ver el historial:
  Get-Content C:\puranota\scripts\keep-alive.log -Tail 20

Ejecutar el ping a mano (probar):
  powershell -ExecutionPolicy Bypass -File C:\puranota\scripts\keep-alive-supabase.ps1

Ver / detener / borrar la tarea:
  Get-ScheduledTask -TaskName 'PuraNota-KeepAlive'
  Disable-ScheduledTask -TaskName 'PuraNota-KeepAlive'
  Unregister-ScheduledTask -TaskName 'PuraNota-KeepAlive' -Confirm:$false

Limitación:
  Corre solo cuando la PC está encendida (con "ponerse al día" si se saltó una
  corrida). Si la PC pasa apagada más de ~1 semana seguida, el proyecto podría
  pausarse igual. Para 100% de garantía sin depender de la PC, usar además el
  cron en la nube (cron-job.org) descrito en docs/keep-alive.md.
