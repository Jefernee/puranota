-- ============================================================
-- AULA CR — ESQUEMA FASE 1 (Supabase / Postgres)
-- Instrucciones: Supabase → SQL Editor → New query → pegar TODO → Run
-- Incluye: tablas, triggers, funciones y políticas RLS completas
-- ============================================================

-- ===================== 1. TABLAS =====================

-- Perfil de cada usuario (se crea automático al registrarse)
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  correo text not null,
  nombre text,
  telefono text,
  seccion text,
  rol text not null default 'estudiante' check (rol in ('docente','estudiante')),
  onboarding_completo boolean not null default false,
  creado_en timestamptz not null default now()
);

-- Grupos (ej. "7-3 Informática 2026")
create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  docente_id uuid not null references public.perfiles(id) on delete cascade,
  nombre text not null,
  materia text,
  nivel text,
  anio int not null default extract(year from now())::int,
  periodo text default 'I Periodo',
  codigo_acceso text not null unique default upper(substr(md5(random()::text), 1, 6)),
  requiere_aprobacion boolean not null default false,
  -- Rubros MEP configurables por grupo (deben sumar 100)
  rubros jsonb not null default '[
    {"nombre":"Trabajo cotidiano","porcentaje":35},
    {"nombre":"Tareas","porcentaje":10},
    {"nombre":"Pruebas","porcentaje":40},
    {"nombre":"Proyecto","porcentaje":10},
    {"nombre":"Asistencia","porcentaje":5}
  ]'::jsonb,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Matrícula: qué estudiante está en qué grupo
create table public.grupo_estudiantes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  estudiante_id uuid not null references public.perfiles(id) on delete cascade,
  estado text not null default 'activo' check (estado in ('activo','pendiente')),
  creado_en timestamptz not null default now(),
  unique (grupo_id, estudiante_id)
);

-- Pre-matrícula: correos cargados por el docente antes de que se registren
create table public.prematriculas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  correo text not null,
  usado boolean not null default false,
  creado_en timestamptz not null default now(),
  unique (grupo_id, correo)
);

-- Asignaciones (cotidianos, tareas, proyectos, pruebas)
create table public.asignaciones (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  titulo text not null,
  instrucciones text,
  rubro text not null default 'Trabajo cotidiano',
  puntos numeric not null default 10,
  fecha_limite timestamptz,
  permite_tardias boolean not null default true,
  -- Rúbrica que también usará Gemini en Fase 2:
  -- [{"criterio":"Portada completa","puntos":2}, ...]
  rubrica jsonb not null default '[]'::jsonb,
  visible boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Entregas de los estudiantes
create table public.entregas (
  id uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null references public.asignaciones(id) on delete cascade,
  estudiante_id uuid not null references public.perfiles(id) on delete cascade,
  estado text not null default 'entregada'
    check (estado in ('entregada','pre_revisada','calificada')),
  tardia boolean not null default false,
  nota numeric,
  observaciones text,
  entregado_en timestamptz not null default now(),
  calificado_en timestamptz,
  unique (asignacion_id, estudiante_id)
);

-- Archivos de cada entrega (varias fotos por cotidiano)
create table public.entrega_archivos (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references public.entregas(id) on delete cascade,
  url text not null,
  nombre text,
  tipo text,
  creado_en timestamptz not null default now()
);

-- Resultado de la revisión con IA (Fase 2; la escribe la Edge Function)
create table public.revisiones_ia (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null unique references public.entregas(id) on delete cascade,
  resultado jsonb,            -- criterios cumplidos, observaciones, etc.
  nota_sugerida numeric,
  confianza numeric,          -- 0 a 1
  estado text not null default 'completada'
    check (estado in ('procesando','completada','error')),
  creado_en timestamptz not null default now()
);

-- Clases / lecciones con video de YouTube y contenido
create table public.clases (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  titulo text not null,
  contenido text,             -- texto/markdown que escribe el docente
  youtube_url text,           -- video no listado o público
  orden int not null default 0,
  visible boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Archivos adjuntos de cada clase (PDFs, imágenes en Cloudinary)
create table public.clase_archivos (
  id uuid primary key default gen_random_uuid(),
  clase_id uuid not null references public.clases(id) on delete cascade,
  url text not null,
  nombre text,
  tipo text,
  creado_en timestamptz not null default now()
);

-- Asistencia
create table public.asistencia (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  estudiante_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null default current_date,
  estado text not null default 'presente'
    check (estado in ('presente','ausente','tardia','justificada')),
  creado_en timestamptz not null default now(),
  unique (grupo_id, estudiante_id, fecha)
);

-- Configuración de IA editable sin redesplegar (Fase 2)
create table public.config_ia (
  id uuid primary key default gen_random_uuid(),
  docente_id uuid not null references public.perfiles(id) on delete cascade,
  prompt_sistema text not null default 'Eres un asistente que pre-revisa trabajos escolares según una rúbrica. Responde SOLO en JSON.',
  modelo text not null default 'gemini-2.5-flash',
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ===================== 2. ÍNDICES =====================

create index idx_ge_grupo on public.grupo_estudiantes(grupo_id);
create index idx_ge_estudiante on public.grupo_estudiantes(estudiante_id);
create index idx_asig_grupo on public.asignaciones(grupo_id);
create index idx_ent_asig on public.entregas(asignacion_id);
create index idx_ent_est on public.entregas(estudiante_id);
create index idx_ea_entrega on public.entrega_archivos(entrega_id);
create index idx_clases_grupo on public.clases(grupo_id);
create index idx_ca_clase on public.clase_archivos(clase_id);
create index idx_asis_grupo_fecha on public.asistencia(grupo_id, fecha);
create index idx_prem_correo on public.prematriculas(correo);

-- ===================== 3. FUNCIONES AUXILIARES =====================
-- (security definer = rompen la recursión de RLS de forma segura)

-- ¿El usuario actual es docente?
create or replace function public.es_docente()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = 'docente'
  );
$$;

-- ¿El usuario actual es el docente dueño de este grupo?
create or replace function public.es_docente_de_grupo(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from grupos where id = gid and docente_id = auth.uid()
  );
$$;

-- ¿El usuario actual es estudiante activo de este grupo?
create or replace function public.es_miembro_de_grupo(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from grupo_estudiantes
    where grupo_id = gid and estudiante_id = auth.uid() and estado = 'activo'
  );
$$;

-- ===================== 4. TRIGGERS =====================

-- 4.1 Crear perfil automáticamente al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, correo)
  values (new.id, lower(new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4.2 Auto-matrícula: si el correo estaba pre-matriculado, entra al grupo solo
create or replace function public.aplicar_prematriculas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.grupo_estudiantes (grupo_id, estudiante_id, estado)
  select p.grupo_id, new.id, 'activo'
  from public.prematriculas p
  where lower(p.correo) = lower(new.correo) and p.usado = false
  on conflict (grupo_id, estudiante_id) do nothing;

  update public.prematriculas
  set usado = true
  where lower(correo) = lower(new.correo) and usado = false;

  return new;
end;
$$;

create trigger on_perfil_created
  after insert on public.perfiles
  for each row execute function public.aplicar_prematriculas();

-- 4.3 Marcar entregas tardías automáticamente
create or replace function public.marcar_tardia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limite timestamptz;
begin
  select fecha_limite into v_limite
  from public.asignaciones where id = new.asignacion_id;

  if v_limite is not null and now() > v_limite then
    new.tardia := true;
  end if;
  return new;
end;
$$;

create trigger on_entrega_insert
  before insert on public.entregas
  for each row execute function public.marcar_tardia();

-- ===================== 5. RPCs (las llama el frontend) =====================

-- Unirse a un grupo con código (estilo Google Classroom)
create or replace function public.unirse_con_codigo(p_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_grupo grupos%rowtype;
  v_estado text;
begin
  select * into v_grupo from grupos
  where codigo_acceso = upper(trim(p_codigo)) and activo = true;

  if v_grupo.id is null then
    return jsonb_build_object('ok', false, 'mensaje', 'Código inválido');
  end if;

  v_estado := case when v_grupo.requiere_aprobacion then 'pendiente' else 'activo' end;

  insert into grupo_estudiantes (grupo_id, estudiante_id, estado)
  values (v_grupo.id, auth.uid(), v_estado)
  on conflict (grupo_id, estudiante_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'grupo', v_grupo.nombre,
    'estado', v_estado
  );
end;
$$;

-- Regenerar código de acceso (solo el docente dueño)
create or replace function public.regenerar_codigo(p_grupo_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_nuevo text;
begin
  if not es_docente_de_grupo(p_grupo_id) then
    raise exception 'No autorizado';
  end if;
  v_nuevo := upper(substr(md5(random()::text), 1, 6));
  update grupos set codigo_acceso = v_nuevo where id = p_grupo_id;
  return v_nuevo;
end;
$$;

-- ===================== 6. ROW LEVEL SECURITY =====================

alter table public.perfiles enable row level security;
alter table public.grupos enable row level security;
alter table public.grupo_estudiantes enable row level security;
alter table public.prematriculas enable row level security;
alter table public.asignaciones enable row level security;
alter table public.entregas enable row level security;
alter table public.entrega_archivos enable row level security;
alter table public.revisiones_ia enable row level security;
alter table public.clases enable row level security;
alter table public.clase_archivos enable row level security;
alter table public.asistencia enable row level security;
alter table public.config_ia enable row level security;

-- ---------- perfiles ----------
create policy "ver mi perfil" on public.perfiles
  for select using (id = auth.uid());

create policy "docente ve perfiles" on public.perfiles
  for select using (es_docente());

create policy "editar mi perfil" on public.perfiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and rol = (select rol from public.perfiles where id = auth.uid()));
-- Nota: el rol NO se puede auto-cambiar; el rol docente se asigna manualmente
-- en la base (Table Editor) una sola vez, para tu propio usuario.

-- ---------- grupos ----------
create policy "docente gestiona sus grupos" on public.grupos
  for all using (docente_id = auth.uid())
  with check (docente_id = auth.uid() and es_docente());

create policy "estudiante ve sus grupos" on public.grupos
  for select using (es_miembro_de_grupo(id));

-- ---------- grupo_estudiantes ----------
create policy "docente gestiona matricula" on public.grupo_estudiantes
  for all using (es_docente_de_grupo(grupo_id))
  with check (es_docente_de_grupo(grupo_id));

create policy "estudiante ve su matricula" on public.grupo_estudiantes
  for select using (estudiante_id = auth.uid());

-- (la inserción del estudiante ocurre solo vía RPC unirse_con_codigo)

-- ---------- prematriculas ----------
create policy "docente gestiona prematriculas" on public.prematriculas
  for all using (es_docente_de_grupo(grupo_id))
  with check (es_docente_de_grupo(grupo_id));

-- ---------- asignaciones ----------
create policy "docente gestiona asignaciones" on public.asignaciones
  for all using (es_docente_de_grupo(grupo_id))
  with check (es_docente_de_grupo(grupo_id));

create policy "estudiante ve asignaciones visibles" on public.asignaciones
  for select using (visible = true and es_miembro_de_grupo(grupo_id));

-- ---------- entregas ----------
create policy "estudiante crea su entrega" on public.entregas
  for insert with check (
    estudiante_id = auth.uid()
    and exists (
      select 1 from public.asignaciones a
      where a.id = asignacion_id
        and a.visible = true
        and es_miembro_de_grupo(a.grupo_id)
        and (a.permite_tardias = true or a.fecha_limite is null or now() <= a.fecha_limite)
    )
  );

create policy "estudiante ve sus entregas" on public.entregas
  for select using (estudiante_id = auth.uid());

create policy "estudiante reemplaza antes del limite" on public.entregas
  for update using (
    estudiante_id = auth.uid()
    and estado = 'entregada'
    and exists (
      select 1 from public.asignaciones a
      where a.id = asignacion_id
        and (a.fecha_limite is null or now() <= a.fecha_limite)
    )
  )
  with check (estudiante_id = auth.uid() and nota is null and estado = 'entregada');

create policy "docente ve entregas de sus grupos" on public.entregas
  for select using (
    exists (
      select 1 from public.asignaciones a
      where a.id = asignacion_id and es_docente_de_grupo(a.grupo_id)
    )
  );

create policy "docente califica" on public.entregas
  for update using (
    exists (
      select 1 from public.asignaciones a
      where a.id = asignacion_id and es_docente_de_grupo(a.grupo_id)
    )
  );

-- ---------- entrega_archivos ----------
create policy "estudiante gestiona sus archivos" on public.entrega_archivos
  for all using (
    exists (select 1 from public.entregas e
            where e.id = entrega_id and e.estudiante_id = auth.uid()
              and e.estado = 'entregada')
  )
  with check (
    exists (select 1 from public.entregas e
            where e.id = entrega_id and e.estudiante_id = auth.uid())
  );

create policy "docente ve archivos" on public.entrega_archivos
  for select using (
    exists (
      select 1 from public.entregas e
      join public.asignaciones a on a.id = e.asignacion_id
      where e.id = entrega_id and es_docente_de_grupo(a.grupo_id)
    )
  );

-- ---------- revisiones_ia ----------
create policy "docente ve revisiones" on public.revisiones_ia
  for select using (
    exists (
      select 1 from public.entregas e
      join public.asignaciones a on a.id = e.asignacion_id
      where e.id = entrega_id and es_docente_de_grupo(a.grupo_id)
    )
  );
-- (las escribe la Edge Function con service_role, que ignora RLS)

-- ---------- clases ----------
create policy "docente gestiona clases" on public.clases
  for all using (es_docente_de_grupo(grupo_id))
  with check (es_docente_de_grupo(grupo_id));

create policy "estudiante ve clases visibles" on public.clases
  for select using (visible = true and es_miembro_de_grupo(grupo_id));

-- ---------- clase_archivos ----------
create policy "docente gestiona archivos de clase" on public.clase_archivos
  for all using (
    exists (select 1 from public.clases c
            where c.id = clase_id and es_docente_de_grupo(c.grupo_id))
  )
  with check (
    exists (select 1 from public.clases c
            where c.id = clase_id and es_docente_de_grupo(c.grupo_id))
  );

create policy "estudiante ve archivos de clase" on public.clase_archivos
  for select using (
    exists (select 1 from public.clases c
            where c.id = clase_id and c.visible = true and es_miembro_de_grupo(c.grupo_id))
  );

-- ---------- asistencia ----------
create policy "docente gestiona asistencia" on public.asistencia
  for all using (es_docente_de_grupo(grupo_id))
  with check (es_docente_de_grupo(grupo_id));

create policy "estudiante ve su asistencia" on public.asistencia
  for select using (estudiante_id = auth.uid());

-- ---------- config_ia ----------
create policy "docente gestiona su config ia" on public.config_ia
  for all using (docente_id = auth.uid() and es_docente())
  with check (docente_id = auth.uid() and es_docente());

-- ============================================================
-- PASO MANUAL FINAL (una sola vez, después de registrarte):
-- 1. Registrate en la app con tu correo.
-- 2. En Supabase → Table Editor → perfiles → tu fila → rol = 'docente'.
-- ============================================================
