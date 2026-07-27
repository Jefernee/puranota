-- ============================================================================
-- PuraNota — esquema completo de la base
-- ============================================================================
-- Generado desde la base REAL de producción el 2026-07-26, leyendo el catálogo
-- de Postgres. Reemplaza a `aula_cr_fase1_schema.sql`, que había quedado
-- desactualizado (le faltaban todas las columnas agregadas a mano después de
-- la Fase 1: periodo, porcentaje, tipo, periodos_fechas, la tabla anuncios…).
--
-- Para qué sirve:
--   1. Levantar el proyecto de STAGING con la misma forma que producción.
--   2. Reconstruir el sistema desde cero si hiciera falta.
--   3. Leer la verdad del esquema sin tener que abrir el panel de Supabase.
--
-- Este archivo NO trae datos. Los respaldos con datos viven cifrados en el
-- repositorio privado `puranota-respaldos` (D14/D16).
--
-- Orden: tablas → restricciones → índices → funciones → triggers → RLS.
-- ============================================================================

-- ─── 1. Tablas ──────────────────────────────────────────────────────────────

create table public.perfiles (
  id uuid not null,
  correo text not null,
  nombre text,
  telefono text,
  seccion text,
  rol text default 'estudiante'::text not null,
  onboarding_completo boolean default false not null,
  creado_en timestamp with time zone default now() not null,
  pregunta_seguridad text,
  respuesta_hash text,
  debe_cambiar_clave boolean default false not null
);

create table public.grupos (
  id uuid default gen_random_uuid() not null,
  docente_id uuid not null,
  nombre text not null,
  materia text,
  nivel text,
  anio integer default (EXTRACT(year FROM now()))::integer not null,
  -- OJO (ADR-001): `periodo` NO guarda "I Periodo", guarda la CANTIDAD de
  -- periodos del grupo como texto ("2" o "3"). El default quedó del modelo
  -- viejo; lib/periodos.js lo interpreta y cae a 2 ante cualquier otro valor.
  periodo text default 'I Periodo'::text,
  codigo_acceso text default upper(substr(md5((random())::text), 1, 6)) not null,
  requiere_aprobacion boolean default false not null,
  -- Agrupado por periodo: {"I":[{nombre,porcentaje}], "II":[…]}. Cada periodo
  -- suma 100 por separado, incluida la asistencia.
  rubros jsonb default '[{"nombre": "Trabajo cotidiano", "porcentaje": 35}, {"nombre": "Tareas", "porcentaje": 10}, {"nombre": "Pruebas", "porcentaje": 40}, {"nombre": "Proyecto", "porcentaje": 10}, {"nombre": "Asistencia", "porcentaje": 5}]'::jsonb not null,
  activo boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  periodos_fechas jsonb default '{}'::jsonb not null,
  mep_modalidad text,
  especialidad text,
  -- COLUMNAS MUERTAS: existen pero ningún código las lee ni las escribe.
  -- La penalización quedó por asignación y los avisos se movieron a `anuncios`.
  penalizacion_tardia numeric default 0 not null,
  anuncio text
);

create table public.grupo_estudiantes (
  id uuid default gen_random_uuid() not null,
  grupo_id uuid not null,
  estudiante_id uuid not null,
  estado text default 'activo'::text not null,
  creado_en timestamp with time zone default now() not null
);

create table public.prematriculas (
  id uuid default gen_random_uuid() not null,
  grupo_id uuid not null,
  correo text not null,
  usado boolean default false not null,
  creado_en timestamp with time zone default now() not null
);

create table public.clases (
  id uuid default gen_random_uuid() not null,
  grupo_id uuid not null,
  titulo text not null,
  contenido text,
  youtube_url text, -- legado (singular); hoy se usa youtube_urls
  orden integer default 0 not null,
  visible boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  youtube_urls jsonb default '[]'::jsonb not null
);

create table public.clase_archivos (
  id uuid default gen_random_uuid() not null,
  clase_id uuid not null,
  url text not null,
  nombre text,
  tipo text, -- los video/* son el video propio del docente (ADR-005)
  creado_en timestamp with time zone default now() not null
);

create table public.asignaciones (
  id uuid default gen_random_uuid() not null,
  grupo_id uuid not null,
  titulo text not null,
  instrucciones text,
  rubro text default 'Trabajo cotidiano'::text not null, -- se une al rubro POR NOMBRE
  puntos numeric default 10 not null,                    -- escala de calificación
  fecha_limite timestamp with time zone,
  permite_tardias boolean default true not null,
  rubrica jsonb default '[]'::jsonb not null,
  visible boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  periodo text default 'I'::text not null,
  porcentaje numeric,                     -- Valor %: cuánto vale del 100 del periodo
  clase_id uuid,
  archivos jsonb default '[]'::jsonb not null,
  requiere_entrega boolean default true not null,
  penalizacion_tardia numeric default 10 not null,
  tipo text default 'entrega'::text not null
);

create table public.entregas (
  id uuid default gen_random_uuid() not null,
  asignacion_id uuid not null,
  estudiante_id uuid not null,
  estado text default 'entregada'::text not null,
  tardia boolean default false not null, -- la pone el trigger marcar_tardia()
  nota numeric,
  observaciones text,
  entregado_en timestamp with time zone default now() not null,
  calificado_en timestamp with time zone
);

create table public.entrega_archivos (
  id uuid default gen_random_uuid() not null,
  entrega_id uuid not null,
  url text not null,
  nombre text,
  tipo text,
  creado_en timestamp with time zone default now() not null
);

create table public.asistencia (
  id uuid default gen_random_uuid() not null,
  grupo_id uuid not null,
  estudiante_id uuid not null,
  fecha date default CURRENT_DATE not null,
  estado text default 'presente'::text not null,
  creado_en timestamp with time zone default now() not null
);

create table public.anuncios (
  id uuid default gen_random_uuid() not null,
  docente_id uuid not null,
  contenido text not null,
  grupo_ids uuid[] default '{}'::uuid[] not null,
  creado_en timestamp with time zone default now() not null
);

-- Fase 2 (pre-revisión con IA). Existen pero están vacías.
create table public.config_ia (
  id uuid default gen_random_uuid() not null,
  docente_id uuid not null,
  prompt_sistema text default 'Eres un asistente que pre-revisa trabajos escolares según una rúbrica. Responde SOLO en JSON.'::text not null,
  modelo text default 'gemini-2.5-flash'::text not null,
  activo boolean default true not null,
  creado_en timestamp with time zone default now() not null
);

create table public.revisiones_ia (
  id uuid default gen_random_uuid() not null,
  entrega_id uuid not null,
  resultado jsonb,
  nota_sugerida numeric,
  confianza numeric,
  estado text default 'completada'::text not null,
  creado_en timestamp with time zone default now() not null
);

-- ─── 2. Restricciones ───────────────────────────────────────────────────────

alter table public.anuncios add constraint anuncios_pkey primary key (id);
alter table public.asignaciones add constraint asignaciones_pkey primary key (id);
alter table public.asistencia add constraint asistencia_pkey primary key (id);
alter table public.clase_archivos add constraint clase_archivos_pkey primary key (id);
alter table public.clases add constraint clases_pkey primary key (id);
alter table public.config_ia add constraint config_ia_pkey primary key (id);
alter table public.entrega_archivos add constraint entrega_archivos_pkey primary key (id);
alter table public.entregas add constraint entregas_pkey primary key (id);
alter table public.grupo_estudiantes add constraint grupo_estudiantes_pkey primary key (id);
alter table public.grupos add constraint grupos_pkey primary key (id);
alter table public.perfiles add constraint perfiles_pkey primary key (id);
alter table public.prematriculas add constraint prematriculas_pkey primary key (id);
alter table public.revisiones_ia add constraint revisiones_ia_pkey primary key (id);

alter table public.asistencia add constraint asistencia_grupo_id_estudiante_id_fecha_key unique (grupo_id, estudiante_id, fecha);
alter table public.entregas add constraint entregas_asignacion_id_estudiante_id_key unique (asignacion_id, estudiante_id);
alter table public.grupo_estudiantes add constraint grupo_estudiantes_grupo_id_estudiante_id_key unique (grupo_id, estudiante_id);
alter table public.grupos add constraint grupos_codigo_acceso_key unique (codigo_acceso);
alter table public.prematriculas add constraint prematriculas_grupo_id_correo_key unique (grupo_id, correo);
alter table public.revisiones_ia add constraint revisiones_ia_entrega_id_key unique (entrega_id);

alter table public.asignaciones add constraint asignaciones_periodo_check check ((periodo = any (array['I'::text, 'II'::text, 'III'::text])));
alter table public.asignaciones add constraint asignaciones_tipo_check check ((tipo = any (array['entrega'::text, 'prueba'::text, 'proyecto'::text, 'foro'::text])));
alter table public.asistencia add constraint asistencia_estado_check check ((estado = any (array['presente'::text, 'ausente'::text, 'tardia'::text, 'justificada'::text])));
alter table public.entregas add constraint entregas_estado_check check ((estado = any (array['entregada'::text, 'pre_revisada'::text, 'calificada'::text])));
alter table public.grupo_estudiantes add constraint grupo_estudiantes_estado_check check ((estado = any (array['activo'::text, 'pendiente'::text])));
alter table public.perfiles add constraint perfiles_rol_check check ((rol = any (array['docente'::text, 'estudiante'::text])));
alter table public.revisiones_ia add constraint revisiones_ia_estado_check check ((estado = any (array['procesando'::text, 'completada'::text, 'error'::text])));

alter table public.perfiles add constraint perfiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.grupos add constraint grupos_docente_id_fkey foreign key (docente_id) references perfiles(id) on delete cascade;
alter table public.anuncios add constraint anuncios_docente_id_fkey foreign key (docente_id) references perfiles(id) on delete cascade;
alter table public.asignaciones add constraint asignaciones_grupo_id_fkey foreign key (grupo_id) references grupos(id) on delete cascade;
alter table public.asignaciones add constraint asignaciones_clase_id_fkey foreign key (clase_id) references clases(id) on delete set null;
alter table public.asistencia add constraint asistencia_estudiante_id_fkey foreign key (estudiante_id) references perfiles(id) on delete cascade;
alter table public.asistencia add constraint asistencia_grupo_id_fkey foreign key (grupo_id) references grupos(id) on delete cascade;
alter table public.clase_archivos add constraint clase_archivos_clase_id_fkey foreign key (clase_id) references clases(id) on delete cascade;
alter table public.clases add constraint clases_grupo_id_fkey foreign key (grupo_id) references grupos(id) on delete cascade;
alter table public.config_ia add constraint config_ia_docente_id_fkey foreign key (docente_id) references perfiles(id) on delete cascade;
alter table public.entrega_archivos add constraint entrega_archivos_entrega_id_fkey foreign key (entrega_id) references entregas(id) on delete cascade;
alter table public.entregas add constraint entregas_asignacion_id_fkey foreign key (asignacion_id) references asignaciones(id) on delete cascade;
alter table public.entregas add constraint entregas_estudiante_id_fkey foreign key (estudiante_id) references perfiles(id) on delete cascade;
alter table public.grupo_estudiantes add constraint grupo_estudiantes_estudiante_id_fkey foreign key (estudiante_id) references perfiles(id) on delete cascade;
alter table public.grupo_estudiantes add constraint grupo_estudiantes_grupo_id_fkey foreign key (grupo_id) references grupos(id) on delete cascade;
alter table public.prematriculas add constraint prematriculas_grupo_id_fkey foreign key (grupo_id) references grupos(id) on delete cascade;
alter table public.revisiones_ia add constraint revisiones_ia_entrega_id_fkey foreign key (entrega_id) references entregas(id) on delete cascade;

-- ─── 3. Índices ─────────────────────────────────────────────────────────────

create index idx_asig_grupo on public.asignaciones using btree (grupo_id);
create index idx_asis_grupo_fecha on public.asistencia using btree (grupo_id, fecha);
create index idx_ca_clase on public.clase_archivos using btree (clase_id);
create index idx_clases_grupo on public.clases using btree (grupo_id);
create index idx_ea_entrega on public.entrega_archivos using btree (entrega_id);
create index idx_ent_asig on public.entregas using btree (asignacion_id);
create index idx_ent_est on public.entregas using btree (estudiante_id);
create index idx_ge_estudiante on public.grupo_estudiantes using btree (estudiante_id);
create index idx_ge_grupo on public.grupo_estudiantes using btree (grupo_id);
create index idx_prem_correo on public.prematriculas using btree (correo);

-- ─── 4. Funciones ───────────────────────────────────────────────────────────
-- Las tres primeras son las que usan las políticas RLS.

create or replace function public.es_docente()
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'docente');
$function$;

create or replace function public.es_docente_de_grupo(gid uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (select 1 from grupos where id = gid and docente_id = auth.uid());
$function$;

create or replace function public.es_miembro_de_grupo(gid uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (
    select 1 from grupo_estudiantes
    where grupo_id = gid and estudiante_id = auth.uid() and estado = 'activo'
  );
$function$;

-- Crea la fila en `perfiles` al registrarse un usuario.
create or replace function public.handle_new_user()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.perfiles (id, correo) values (new.id, lower(new.email));
  return new;
end;
$function$;

-- Al crearse el perfil, lo mete a los grupos donde su correo estaba prematriculado.
create or replace function public.aplicar_prematriculas()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.grupo_estudiantes (grupo_id, estudiante_id, estado)
  select p.grupo_id, new.id, 'activo'
  from public.prematriculas p
  where lower(p.correo) = lower(new.correo) and p.usado = false
  on conflict (grupo_id, estudiante_id) do nothing;

  update public.prematriculas set usado = true
  where lower(correo) = lower(new.correo) and usado = false;

  return new;
end;
$function$;

-- Si el docente prematricula a alguien YA registrado, lo mete al grupo al toque.
create or replace function public.aplicar_prematricula_inmediata()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.grupo_estudiantes (grupo_id, estudiante_id, estado)
  select new.grupo_id, pf.id, 'activo'
  from public.perfiles pf
  where lower(pf.correo) = lower(new.correo)
  on conflict (grupo_id, estudiante_id) do nothing;

  if exists (select 1 from public.perfiles pf where lower(pf.correo) = lower(new.correo)) then
    new.usado := true;
  end if;

  return new;
end;
$function$;

-- OJO: corre solo en INSERT, nunca en UPDATE (ver CLAUDE.md §7.6 A).
create or replace function public.marcar_tardia()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_limite timestamptz;
begin
  select fecha_limite into v_limite from public.asignaciones where id = new.asignacion_id;
  if v_limite is not null and now() > v_limite then
    new.tardia := true;
  end if;
  return new;
end;
$function$;

-- El estudiante entra al grupo. No lanza error con código inválido: devuelve
-- ok:false para poder mostrarlo como mensaje.
create or replace function public.unirse_con_codigo(p_codigo text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
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

  return jsonb_build_object('ok', true, 'grupo', v_grupo.nombre, 'estado', v_estado);
end;
$function$;

create or replace function public.regenerar_codigo(p_grupo_id uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
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
$function$;

-- ─── 5. Triggers ────────────────────────────────────────────────────────────

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create trigger on_perfil_created after insert on public.perfiles
  for each row execute function public.aplicar_prematriculas();
create trigger on_prematricula_created before insert on public.prematriculas
  for each row execute function public.aplicar_prematricula_inmediata();
create trigger on_entrega_insert before insert on public.entregas
  for each row execute function public.marcar_tardia();

-- ─── 6. Seguridad a nivel de fila ───────────────────────────────────────────

alter table public.anuncios enable row level security;
alter table public.asignaciones enable row level security;
alter table public.asistencia enable row level security;
alter table public.clase_archivos enable row level security;
alter table public.clases enable row level security;
alter table public.config_ia enable row level security;
alter table public.entrega_archivos enable row level security;
alter table public.entregas enable row level security;
alter table public.grupo_estudiantes enable row level security;
alter table public.grupos enable row level security;
alter table public.perfiles enable row level security;
alter table public.prematriculas enable row level security;
alter table public.revisiones_ia enable row level security;

-- perfiles
create policy "ver mi perfil" on public.perfiles for select
  using ((id = auth.uid()));
create policy "docente ve perfiles" on public.perfiles for select
  using (es_docente());
create policy "editar mi perfil" on public.perfiles for update
  using ((id = auth.uid()))
  with check (((id = auth.uid()) and (rol = (select p.rol from perfiles p where p.id = auth.uid())))); -- nadie se asciende a docente solo

-- grupos
create policy "docente gestiona sus grupos" on public.grupos for all
  using ((docente_id = auth.uid()))
  with check (((docente_id = auth.uid()) and es_docente()));
create policy "estudiante ve sus grupos" on public.grupos for select
  using (es_miembro_de_grupo(id));

-- grupo_estudiantes
create policy "docente gestiona matricula" on public.grupo_estudiantes for all
  using (es_docente_de_grupo(grupo_id))
  with check (es_docente_de_grupo(grupo_id));
create policy "estudiante ve su matricula" on public.grupo_estudiantes for select
  using ((estudiante_id = auth.uid()));

-- prematriculas
create policy "docente gestiona prematriculas" on public.prematriculas for all
  using (es_docente_de_grupo(grupo_id))
  with check (es_docente_de_grupo(grupo_id));

-- clases
create policy "docente gestiona clases" on public.clases for all
  using (es_docente_de_grupo(grupo_id))
  with check (es_docente_de_grupo(grupo_id));
create policy "estudiante ve clases visibles" on public.clases for select
  using (((visible = true) and es_miembro_de_grupo(grupo_id)));

create policy "docente gestiona archivos de clase" on public.clase_archivos for all
  using ((exists (select 1 from clases c where ((c.id = clase_archivos.clase_id) and es_docente_de_grupo(c.grupo_id)))))
  with check ((exists (select 1 from clases c where ((c.id = clase_archivos.clase_id) and es_docente_de_grupo(c.grupo_id)))));
create policy "estudiante ve archivos de clase" on public.clase_archivos for select
  using ((exists (select 1 from clases c where ((c.id = clase_archivos.clase_id) and (c.visible = true) and es_miembro_de_grupo(c.grupo_id)))));

-- asignaciones
create policy "docente gestiona asignaciones" on public.asignaciones for all
  using (es_docente_de_grupo(grupo_id))
  with check (es_docente_de_grupo(grupo_id));
create policy "estudiante ve asignaciones visibles" on public.asignaciones for select
  using (((visible = true) and es_miembro_de_grupo(grupo_id)));

-- entregas
create policy "docente ve entregas de sus grupos" on public.entregas for select
  using ((exists (select 1 from asignaciones a where ((a.id = entregas.asignacion_id) and es_docente_de_grupo(a.grupo_id)))));
create policy "docente califica" on public.entregas for update
  using ((exists (select 1 from asignaciones a where ((a.id = entregas.asignacion_id) and es_docente_de_grupo(a.grupo_id)))));
-- Necesaria para calificarPorEstudiante (nota directa sin entrega del alumno).
create policy "docente crea entrega" on public.entregas for insert
  with check ((exists (select 1 from asignaciones a where ((a.id = entregas.asignacion_id) and es_docente_de_grupo(a.grupo_id)))));
create policy "estudiante ve sus entregas" on public.entregas for select
  using ((estudiante_id = auth.uid()));
create policy "estudiante crea su entrega" on public.entregas for insert
  with check (((estudiante_id = auth.uid()) and (exists (
    select 1 from asignaciones a
    where ((a.id = entregas.asignacion_id) and (a.visible = true) and es_miembro_de_grupo(a.grupo_id)
      and ((a.permite_tardias = true) or (a.fecha_limite is null) or (now() <= a.fecha_limite)))))));
create policy "estudiante reemplaza antes del limite" on public.entregas for update
  using (((estudiante_id = auth.uid()) and (estado = 'entregada'::text) and (exists (
    select 1 from asignaciones a
    where ((a.id = entregas.asignacion_id) and ((a.fecha_limite is null) or (now() <= a.fecha_limite)))))))
  with check (((estudiante_id = auth.uid()) and (nota is null) and (estado = 'entregada'::text)));

-- entrega_archivos
create policy "docente ve archivos" on public.entrega_archivos for select
  using ((exists (select 1 from (entregas e join asignaciones a on ((a.id = e.asignacion_id)))
    where ((e.id = entrega_archivos.entrega_id) and es_docente_de_grupo(a.grupo_id)))));
-- Aditiva de solo lectura (ADR-004): sin ella, al calificar la entrega el
-- estudiante dejaba de ver lo que había entregado.
create policy "estudiante ve sus archivos" on public.entrega_archivos for select
  using ((exists (select 1 from entregas e where ((e.id = entrega_archivos.entrega_id) and (e.estudiante_id = auth.uid())))));
-- El `estado = 'entregada'` va en AMBOS lados: en un INSERT solo manda el
-- with check, y sin él se podían adjuntar archivos a una entrega ya calificada
-- (corregido el 2026-07-26).
create policy "estudiante gestiona sus archivos" on public.entrega_archivos for all
  using ((exists (select 1 from entregas e where ((e.id = entrega_archivos.entrega_id) and (e.estudiante_id = auth.uid()) and (e.estado = 'entregada'::text)))))
  with check ((exists (select 1 from entregas e where ((e.id = entrega_archivos.entrega_id) and (e.estudiante_id = auth.uid()) and (e.estado = 'entregada'::text)))));

-- asistencia
create policy "docente gestiona asistencia" on public.asistencia for all
  using (es_docente_de_grupo(grupo_id))
  with check (es_docente_de_grupo(grupo_id));
create policy "estudiante ve su asistencia" on public.asistencia for select
  using ((estudiante_id = auth.uid()));

-- anuncios
create policy "docente gestiona sus anuncios" on public.anuncios for all
  using ((docente_id = auth.uid()))
  with check ((docente_id = auth.uid()));
create policy "estudiante ve anuncios de sus grupos" on public.anuncios for select
  using ((exists (select 1 from grupo_estudiantes ge
    where ((ge.estudiante_id = auth.uid()) and (ge.estado = 'activo'::text) and (ge.grupo_id = any (anuncios.grupo_ids))))));

-- Fase 2
create policy "docente gestiona su config ia" on public.config_ia for all
  using (((docente_id = auth.uid()) and es_docente()))
  with check (((docente_id = auth.uid()) and es_docente()));
create policy "docente ve revisiones" on public.revisiones_ia for select
  using ((exists (select 1 from (entregas e join asignaciones a on ((a.id = e.asignacion_id)))
    where ((e.id = revisiones_ia.entrega_id) and es_docente_de_grupo(a.grupo_id)))));
