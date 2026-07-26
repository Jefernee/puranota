# Keep-alive de Supabase (que no se vuelva a pausar)

El plan gratuito de Supabase **pausa el proyecto cuando ve poca actividad en la
base durante 7 días**. Ya pasó dos veces. Este documento explica **por qué falló
lo que teníamos** y qué hay que montar para que no vuelva a pasar.

Datos del proyecto (este repositorio es **público**, así que acá van marcadores;
los valores reales están en tu `frontend/.env`, que no se versiona):
- URL: `https://<TU-PROJECT-REF>.supabase.co` — el ref real también sale de
  `supabase projects list` o de `supabase/.temp/project-ref` (local).
- La **anon key** está en `frontend/.env` → `VITE_SUPABASE_ANON_KEY`.
  Es **pública** (ya viaja en el frontend), no es la `service_role`.

---

## Qué falló (2026-07-22)

1. **La tarea programada de Windows sí corrió.** `scripts/keep-alive.log` muestra
   `OK HTTP 200` casi todos los días hasta el 21 de julio. El 22 ya no resolvía el
   DNS: el proyecto ya estaba pausado.
   → **Un ping por día no fue suficiente.** La documentación de Supabase habla de
   *"unas pocas solicitudes a la base por día"*; una sola consulta diaria queda
   justo en el filo.
2. **La GitHub Action nunca corrió.** El proyecto **no es un repositorio git** ni
   está en GitHub. `.github/workflows/keep-alive.yml` es decorativo hoy.
3. La tarea de Windows además solo corre con la computadora encendida.

---

## Qué montar (en orden de recomendación)

### ✅ 1. UptimeRobot cada 5 minutos — *recomendado*

Gratis, externo, no depende de la computadora, y de paso avisa por correo si el
sitio se cae.

1. Cuenta gratis en <https://uptimerobot.com>.
2. **Add New Monitor** → tipo **HTTP(s)** → intervalo **5 minutos** → URL:

```
https://<TU-PROJECT-REF>.supabase.co/rest/v1/grupos?select=id&limit=1&apikey=TU_ANON_KEY
```

3. **Probá primero la URL en el navegador**: tiene que devolver `200` y un JSON
   (`[]` está bien, significa que RLS filtró todo pero la consulta llegó a Postgres).
   Si devuelve `401`, la key está mal copiada.

Eso son ~288 consultas reales a la base por día. La inactividad deja de ser
discutible.

### 2. cron-job.org cada 6 horas — segundo respaldo

Gratis, en <https://cron-job.org>. Misma URL, o método GET con headers:
`apikey: TU_ANON_KEY` y `Authorization: Bearer TU_ANON_KEY`.

Tener **dos servicios independientes** es lo que hace que esto no vuelva a pasar:
si uno se cae o desactiva la cuenta por inactividad, queda el otro.

### 3. Tarea de Windows — tercer respaldo

Ya existe (`PuraNota-KeepAlive`, ver `scripts/README-keep-alive.txt`). Conviene
**subirla de diaria a cada 6 horas**:

```powershell
$t = New-ScheduledTaskTrigger -Once -At (Get-Date) `
      -RepetitionInterval (New-TimeSpan -Hours 6)
Set-ScheduledTask -TaskName 'PuraNota-KeepAlive' -Trigger $t
```

No depender de ella: la PC apagada una semana = proyecto pausado.

### 4. El correo de aviso

Supabase manda un correo al dueño **~1 semana antes** de pausar. Con abrir el
dashboard una vez ya se evita. No lo ignores.

### 5. La única garantía real: plan Pro

US$25/mes. **Los proyectos de pago no se pausan nunca.** Si PuraNota va a usarse
con estudiantes de verdad, es el paso correcto — ningún keep-alive es un contrato.

---

## Si vuelve a pasar

Hay **90 días** para restaurar sin perder nada: dashboard → el proyecto →
**Resume project**. Tarda unos minutos y los datos vuelven intactos.
Pasados los 90 días, ya no se puede.
