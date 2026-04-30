# Auditoría de rendimiento — Prototipalo

**Fecha:** 2026-04-27
**Alcance:** `src/app/**/*.{page,layout,actions}.tsx|.ts` + `src/lib/supabase/**` + revisión de índices en `supabase/migrations/**`.

## Resumen de hallazgos

- **HIGH:** 8
- **MEDIUM:** 11
- **LOW:** 6
- **Total:** 25

Páginas ya optimizadas que sirven de referencia (no se reportan): `src/app/dashboard/crm/comisiones/page.tsx` y `src/app/dashboard/crm/list/page.tsx`. El resto del dashboard arrastra patrones que el usuario quiere alinear.

> Cuando un hallazgo refiere a "tabla grande", se asume que `leads`, `quote_requests`, `lead_activities`, `projects`, `tasks`, `sent_emails`, `notifications` crecen de forma indefinida (>1k filas). Las tablas de catálogo (`printers`, `printer_types`, `holidays`, `email_snippets`, etc.) son pequeñas y se ignoran en consideraciones de paginación / select ancho.

---

## HIGH

### [HIGH] — `lead_activities` traído entero para todos los leads activos en Tracker
- **Archivo:** `src/app/dashboard/crm/timeline/page.tsx:96-110`
- **Patrón:** Agregación/filtrado en JS que podría hacerse en SQL
- **Qué pasa:** Se hace `.select("lead_id, created_at, activity_type").in("lead_id", leadIds)` SIN `order/limit` por lead, y luego en JS se itera para quedarse con la actividad más reciente por lead. Para N leads activos con M actividades cada uno, viajan N×M filas por la red. Si hay 200 leads activos con 20 actividades cada uno son 4000 filas para mostrar 200.
- **Solución propuesta:** Crear una RPC/vista `latest_activity_per_lead(lead_ids uuid[])` con `DISTINCT ON (lead_id) ... ORDER BY lead_id, created_at DESC`, o usar la query agregada en SQL. Alternativa rápida: añadir columnas `last_activity_at`/`last_activity_type` directamente en `leads` y mantenerlas con un trigger en `lead_activities`.
- **Riesgo del cambio:** Medio — toca una página caliente (Tracker) y requiere RPC nueva o columna nueva con backfill.

### [HIGH] — N+1 de `count` con `ilike` por cada lead pagado en commission preview
- **Archivo:** `src/app/dashboard/crm/actions.ts:3001-3011` (también `2848-2856` en `getMyCommissionPreview`)
- **Patrón:** N+1 queries
- **Qué pasa:** Dentro del bucle `for (const lead of wonLeads)` se ejecuta un `supabase.from("leads").select("id", { count: "exact", head: true }).ilike("email", lead.email).eq("status","paid")...` por cada lead. Una facturación de 25k€/mes con muchos clientes hace ~10–25 round-trips serializados solo para marcar "returning". Además `ilike` sobre `email` no tiene índice (no aparece en migraciones).
- **Solución propuesta:** Una única query: `.from("leads").select("email, created_at").in("email", emailsToCheck.map(e=>e.toLowerCase())).eq("status","paid").lt("created_at", maxCreatedAt)` y resolver "returning" en memoria — exactamente el patrón ya usado en `comisiones/page.tsx:253-276`. Añadir índice `CREATE INDEX ON leads (lower(email)) WHERE status='paid'`.
- **Riesgo del cambio:** Bajo — patrón ya validado y aplicado en la página de comisiones; misma lógica reutilizable.

### [HIGH] — `getMyCommissionPreview` no paraleliza `getCloserAccumulated`
- **Archivo:** `src/app/dashboard/crm/actions.ts:2806-2811`
- **Patrón:** Queries secuenciales paralelizables
- **Qué pasa:** El loop `for (const closerId of closerIds) { ... await getCloserAccumulated(...) }` ejecuta una llamada por closer en serie. Dentro de cada llamada hay 2 queries más. Con 3-4 closers son 6-8 round-trips secuenciales que pueden ir en `Promise.all` (como ya se hace en `getMyCommissionData:2964-2968` y `getUserMonthlyCommission:3163-3167`).
- **Solución propuesta:** Replicar el `Promise.all` de las otras dos funciones. Es una copia textual de 5 líneas. Mejor: refactorizar las tres funciones para compartir un helper único — hay duplicación masiva entre ellas.
- **Riesgo del cambio:** Bajo — la otra variante ya usa `Promise.all`, simplemente queda alinear.

### [HIGH] — `dashboard/page.tsx` carga TODOS los `project_items` de proyectos confirmados
- **Archivo:** `src/app/dashboard/page.tsx:28-32`
- **Patrón:** `select("*")` o select muy ancho + falta de `.limit()`
- **Qué pasa:** `from("projects").select("*, project_items(id, name, quantity, completed)").eq("project_type","confirmed")` sin ningún filtro temporal. Con cada proyecto histórico el payload crece. Además el `*` en `projects` trae notes, descriptions, holded_proforma_id, payment_confirmed_at, etc. — pero el Kanban sólo muestra una fracción.
- **Solución propuesta:** (a) Limitar el SELECT a las columnas que el Kanban realmente pinta (revisar `KanbanCard`/`KanbanBoard`); (b) excluir proyectos `delivered` con más de N días (o solo confirmados activos: `.neq("status","delivered")` + un filtro de fecha) y mover los entregados a una vista archivo. La página es la principal del dashboard — se carga cada inicio de sesión.
- **Riesgo del cambio:** Medio — hay que confirmar qué campos consume `KanbanBoard` y validar que `delivered` antiguos no aparezcan en el tablero.

### [HIGH] — `crm/[id]/page.tsx` ejecuta `quote_requests` 3 veces para el mismo lead
- **Archivo:** `src/app/dashboard/crm/[id]/page.tsx:164,189,356`
- **Patrón:** Llamadas redundantes
- **Qué pasa:** En el detalle de lead se piden tres `quote_requests` distintos para el MISMO `lead_id`, con tres ventanas distintas de columnas (`*` en `ProformaSection`, `holded_proforma_id` en `EmailSection`, `*` en `ActionsSection`). Cada uno hace `eq("lead_id").order(...).limit(1).maybeSingle()`. Aunque están en `Suspense` paralelos, la base de datos sirve 3 reads por render (y `select("*")` trae el JSON de items pesado dos veces).
- **Solución propuesta:** Un único `getLatestQuoteRequest(leadId)` cacheado a nivel de request con `cache()` de React (o consumido como prop en el padre que las renderiza). Devolver todas las columnas necesarias en un solo viaje.
- **Riesgo del cambio:** Medio — las 3 secciones están dentro de `<Suspense>` distintos por diseño (streaming), pero `cache()` mantiene el streaming y deduplica.

### [HIGH] — `print_jobs` sin `.limit()` en panel de control y queue
- **Archivo:** `src/app/dashboard/control/page.tsx:105`, `src/app/dashboard/queue/page.tsx:19-38`
- **Patrón:** Falta de `.limit()` o paginación
- **Qué pasa:** El control trae `print_jobs` completos sin filtro temporal; queue/page filtra a `status in ("queued","printing","done")` pero `done` es ilimitado e histórico. En un taller con 12 impresoras esa tabla se llena a buen ritmo.
- **Solución propuesta:** En queue: cambiar a `.in("status", ["queued","printing"]).order("position")` y, si se quiere mostrar histórico, una segunda query con `.eq("status","done").gte("completed_at", D-7d).limit(200)`. En control: filtrar al mes actual o solo `["queued","printing"]` (que es lo que realmente se renderiza arriba).
- **Riesgo del cambio:** Bajo — la UI ya distingue estados y la timeline solo necesita lo activo.

### [HIGH] — Control page duplica query de `leads` (dos veces el mismo set)
- **Archivo:** `src/app/dashboard/control/page.tsx:107,115-119`
- **Patrón:** Llamadas redundantes
- **Qué pasa:** El `Promise.all` lanza `leads` (id,status,source,created_at) y `leadsRaw` (created_at) sobre la misma ventana `gte("created_at","2026-03-30T14:00:00Z")`. `leadsRaw` es un subset estricto de `leads` — `leadsRaw` es completamente redundante. El `for (const lead of leadsRaw)` que la usa puede iterar `allLeads` directamente.
- **Solución propuesta:** Borrar la query `leadsRaw` y usar `allLeads` para construir `dayMap`. Ahorra 1 round-trip a Supabase con datos no triviales.
- **Riesgo del cambio:** Bajo — cambio mecánico, ambas queries devuelven `created_at`.

### [HIGH] — `equipo/page.tsx` consulta `user_profiles` dos veces con el MISMO filtro
- **Archivo:** `src/app/dashboard/equipo/page.tsx:121-125,139-143`
- **Patrón:** Llamadas redundantes / Queries secuenciales paralelizables
- **Qué pasa:** Dentro del mismo `Promise.all` hay dos queries a `user_profiles WHERE is_active=true`: una pide `id,email,role,is_active,full_name,nickname,birthday,hire_date` y la otra pide `id,phone,contract_end_date`. Es exactamente la misma fila para cada usuario, partida en dos round-trips porque parece que se añadió `phone`/`contract_end_date` después con un `(supabase as any)`.
- **Solución propuesta:** Pedir TODO en la primera query: `.select("id, email, role, is_active, full_name, nickname, birthday, hire_date, phone, contract_end_date")`. Eliminar `extraFields` y `extraMap`. Si el cast `as any` viene de tipos desactualizados, regenerar `database.types.ts`.
- **Riesgo del cambio:** Bajo — fusión trivial; la misma página ya consume ambos resultados.

---

## MEDIUM

### [MEDIUM] — `crm/[id]/page.tsx`: dos navegaciones (prev/next) que podrían ser una RPC
- **Archivo:** `src/app/dashboard/crm/[id]/page.tsx:421-430`
- **Patrón:** Queries secuenciales paralelizables (van en Promise.all pero son redundantes)
- **Qué pasa:** Para el botón prev/next se ejecutan dos selects sobre `leads` filtrando por `not("status","in","(won,paid,lost)")` con `gt`/`lt` de `created_at`. Con índice no hay drama, pero son dos round-trips para algo que es navegación entre filas adyacentes. En tablas grandes el plan a veces requiere `Sort` aunque haya índice.
- **Solución propuesta:** Crear una RPC `lead_neighbors(lead_id, status_filter)` que devuelva `{prev_id, next_id}` en un único viaje, o cachear la lista ordenada de IDs activos en el cliente / `cache()`.
- **Riesgo del cambio:** Bajo — ya van en `Promise.all`, así que la mejora es marginal pero tira de la página caliente.

### [MEDIUM] — `crm/timeline/page.tsx`: `assigned_to` se pide dos veces para los mismos leads
- **Archivo:** `src/app/dashboard/crm/timeline/page.tsx:75-83`
- **Patrón:** Llamadas redundantes
- **Qué pasa:** Después de poblar `leadAssigneeMap` con los leads activos (que ya tienen `assigned_to`), se ejecuta otra query `from("leads").select("id, assigned_to").in("id", followUpLeadIds)` sólo para los leads de los follow-ups. Pero los follow-ups suelen ser el mismo conjunto (o subconjunto) de leads activos.
- **Solución propuesta:** Filtrar `followUpLeadIds` por los que NO están ya en `leadAssigneeMap` antes de la segunda query. Con suerte esa segunda query desaparece. Si no, sigue siendo un round-trip pequeño.
- **Riesgo del cambio:** Bajo — operación de set diff trivial.

### [MEDIUM] — `crm/timeline/page.tsx`: dos queries de follow-ups que podrían ser una
- **Archivo:** `src/app/dashboard/crm/timeline/page.tsx:37-51`
- **Patrón:** Queries secuenciales paralelizables
- **Qué pasa:** Una query trae follow-ups `>= today AND <= today+30d`, y a continuación otra query trae los `< today` (overdue), ambas con `is("completed_at", null)`. Son dos round-trips secuenciales que pueden ser una sola con `lte("scheduled_date", today+30d)` (sin el `gte today`) y luego se filtra en JS overdue vs futuras.
- **Solución propuesta:** Un único `.from("lead_follow_ups").select(...).is("completed_at", null).lte("scheduled_date", thirtyDaysOut).order("scheduled_date")`. En JS, `agendaItems.filter(f => f.scheduled_date < today)` para overdue.
- **Riesgo del cambio:** Bajo — refactor mecánico.

### [MEDIUM] — `tareas/[id]/page.tsx`: `user_profiles` consultado 2 veces
- **Archivo:** `src/app/dashboard/tareas/[id]/page.tsx:24,26`
- **Patrón:** Llamadas redundantes
- **Qué pasa:** Dentro del mismo `Promise.all` se piden todos los `user_profiles is_active=true` y, separadamente, una sola fila por id (`role`). Esa segunda query se cubre con `getUserProfile()` (ya cacheado) o filtrando el resultado de la primera por `id===userId`.
- **Solución propuesta:** Usar `getUserProfile()` (que ya devuelve `role`) en lugar del cuarto select; o `users.find(u=>u.id===userId)` si ya están en memoria.
- **Riesgo del cambio:** Bajo.

### [MEDIUM] — `dashboard/queue/page.tsx`: `getLaunchSettings` corre en serie tras el `Promise.all`
- **Archivo:** `src/app/dashboard/queue/page.tsx:14-43,73`
- **Patrón:** Queries secuenciales paralelizables
- **Qué pasa:** Después del `Promise.all` que trae `printers/jobs/printer_types`, se hace otro await secuencial a `getLaunchSettings(supabase)` (que lee de Supabase). No depende de los anteriores.
- **Solución propuesta:** Meter `getLaunchSettings(supabase)` en el mismo `Promise.all`.
- **Riesgo del cambio:** Bajo.

### [MEDIUM] — `whatsapp/page.tsx`: dos queries seriales independientes
- **Archivo:** `src/app/dashboard/whatsapp/page.tsx:10-21`
- **Patrón:** Queries secuenciales paralelizables
- **Qué pasa:** `whatsapp_conversations` y `whatsapp_instances` se piden con dos `await` consecutivos sin dependencia. La página es activa (chat) y se vuelve a renderizar mucho.
- **Solución propuesta:** `Promise.all([conversationsQuery, instanceQuery])`.
- **Riesgo del cambio:** Bajo.

### [MEDIUM] — `requests/page.tsx`: dos queries seriales (una depende de la primera, pero podría ser join)
- **Archivo:** `src/app/dashboard/requests/page.tsx:77-95`
- **Patrón:** Queries secuenciales paralelizables / Llamadas redundantes
- **Qué pasa:** Tras traer las requests, se hace `from("user_profiles").select("id,email").in("id", requesterIds)`. Es un patrón clásico que puede resolverse con un join inline: `.select("*, requester:user_profiles!improvement_requests_requested_by_fkey(email)")` para evitar un round-trip extra.
- **Solución propuesta:** Reescribir el select con la relación embebida (mismo patrón que `tareas/page.tsx:67`). Si no hay foreign key declarada, declararla.
- **Riesgo del cambio:** Bajo — si la FK existe.

### [MEDIUM] — `shipments/[id]/page.tsx`: 2 queries secuenciales tras la principal
- **Archivo:** `src/app/dashboard/shipments/[id]/page.tsx:17-36`
- **Patrón:** Queries secuenciales paralelizables
- **Qué pasa:** Tras `shipment` se hacen dos awaits secuenciales (`projects` y `linkedProjectIds`) que no dependen uno de otro y pueden paralelizarse.
- **Solución propuesta:** Envolver las dos últimas en `Promise.all`.
- **Riesgo del cambio:** Bajo.

### [MEDIUM] — `crm/[id]/page.tsx ActivitySection`: trae todas las actividades sin paginación
- **Archivo:** `src/app/dashboard/crm/[id]/page.tsx:212-225` (más `EmailSection:188`)
- **Patrón:** `select("*")` ancho + falta de `.limit()`
- **Qué pasa:** `lead_activities.select("*")` por lead sin `limit`. Para leads muy activos (clientes recurrentes con muchos emails) puede ser >50 filas con `metadata` JSON de tamaño relevante. Encima `EmailSection` repite la misma query.
- **Solución propuesta:** `.limit(100)` por defecto + botón "Ver más". Compartir el resultado entre `ActivitySection` y `EmailSection` (otra repetición — mismo patrón que `quote_requests`). Considerar `.select("id, activity_type, content, metadata, created_at, created_by")` si no se usan otros campos.
- **Riesgo del cambio:** Medio — hay que dividir la responsabilidad de las dos secciones (o consolidarlas) sin romper el streaming actual.

### [MEDIUM] — Control page: `print_jobs.estimated_minutes` agregado en JS sobre tabla creciente
- **Archivo:** `src/app/dashboard/control/page.tsx:105,158-165`
- **Patrón:** Agregación/filtrado en JS que podría hacerse en SQL
- **Qué pasa:** Se trae todo `print_jobs` (sin filtro temporal) sólo para listar 8 jobs activos en un panel y derivar conteos. La agregación "active jobs slice 8" es trivial en SQL: `.in("status",["printing","queued"]).limit(50)`.
- **Solución propuesta:** Filtrar a estados activos y `.limit(50)` en la query. Para estadísticas históricas usar `printer_daily_stats` (que ya existe).
- **Riesgo del cambio:** Bajo.

### [MEDIUM] — `purchases/page.tsx`: query a `user_profiles` adicional secuencial tras el `Promise.all`
- **Archivo:** `src/app/dashboard/purchases/page.tsx:14-39`
- **Patrón:** Queries secuenciales paralelizables
- **Qué pasa:** Tras el `Promise.all` se hace un await extra a `user_profiles` para los creadores. Se podría incluir como join inline en `purchase_items.select("*, project:projects(id,name), creator:user_profiles!purchase_items_created_by_fkey(email)")` y eliminar el round-trip y el cálculo `creatorIds`.
- **Solución propuesta:** Join embebido (mismo patrón que tareas).
- **Riesgo del cambio:** Bajo — si la FK existe.

---

## LOW

### [LOW] — `equipo/page.tsx`: super_admin ejecuta una tercera query de `user_profiles`
- **Archivo:** `src/app/dashboard/equipo/page.tsx:152-158`
- **Patrón:** Queries secuenciales paralelizables
- **Qué pasa:** Tras el `Promise.all` se hace `if (isSuperAdmin) { ... allProfiles ... }` — una cuarta query a `user_profiles` (sin filtro `is_active`). Si se incluye en el primer `Promise.all`, se gana el round-trip.
- **Solución propuesta:** Mover esta query (cuando `isSuperAdmin`) al `Promise.all` superior con un `Promise.resolve({data:null})` para no super_admins (mismo patrón que `overtimeEntries`).
- **Riesgo del cambio:** Bajo.

### [LOW] — `dashboard/projects/[id]/page.tsx`: lead_activities tras el Phase-2 await
- **Archivo:** `src/app/dashboard/projects/[id]/page.tsx:218-228`
- **Patrón:** Queries secuenciales paralelizables
- **Qué pasa:** `if (linkedLead) { await supabase.from("lead_activities")... }` corre en serie tras la Phase-2. Como depende de `linkedLead.id`, no se puede meter en Phase-2, pero sí podría irse en paralelo con cualquier dato derivado (no hay).
- **Solución propuesta:** Una opción: mover la sección a un `<Suspense>` para que el resto de la página pinte sin esperar este round-trip. No bloquea el layout.
- **Riesgo del cambio:** Bajo — afecta a la sección de emails en project detail.

### [LOW] — `dashboard/crm/page.tsx`: `paidQuotes` se trae completo sin filtro temporal
- **Archivo:** `src/app/dashboard/crm/page.tsx:60-65`
- **Patrón:** Falta de `.limit()` o paginación
- **Qué pasa:** `from("quote_requests").select("lead_id, paid_at").eq("payment_status","paid")` sin filtro. Sólo se usa para construir `paidAtMap` (último `paid_at` por lead). Crece linealmente con cada cobro.
- **Solución propuesta:** Limitar a últimos 6/12 meses (`gte("paid_at", D-365d)`). Para mostrar el filtro mensual del Kanban no se necesitan cobros antiguos.
- **Riesgo del cambio:** Bajo — ajusta UI del filtro "Pagados".

### [LOW] — `tareas/page.tsx`: tasks `select("*, ...joins")` sin paginación
- **Archivo:** `src/app/dashboard/tareas/page.tsx:65-88`
- **Patrón:** Falta de `.limit()` o paginación
- **Qué pasa:** Trae toda la tabla `tasks` con joins de 3 tablas. Por defecto filtra `done` (lo excluye) pero al ver "todas" o "done" se descarga el histórico completo.
- **Solución propuesta:** `.limit(200)` con paginación (cursor por `created_at`). Las tareas activas raramente son >100; si se ven todas, paginar.
- **Riesgo del cambio:** Medio — requiere UI de paginación que hoy no existe.

### [LOW] — `emails/page.tsx`: 4 queries secuenciales
- **Archivo:** `src/app/dashboard/emails/page.tsx:80-105`
- **Patrón:** Queries secuenciales paralelizables (parcial)
- **Qué pasa:** Tras `emails`, se ejecutan 3 awaits seriales (`senders`, `leads`, `projects`) que dependen del primero pero no entre sí. Se pueden meter en `Promise.all`.
- **Solución propuesta:** Tras `emails`, lanzar las 3 lookups en `Promise.all`. Con `limit(200)` ya hay tope, pero los 3 round-trips actuales suman ~150ms en frío.
- **Riesgo del cambio:** Bajo.

### [LOW] — `lead_activities` tabla sin índices visibles en migrations
- **Archivo:** `supabase/migrations/**` (ausencia)
- **Patrón:** `ilike`/`like` o filtro frecuente sin índice
- **Qué pasa:** No se ve un `CREATE INDEX ... ON lead_activities(lead_id, created_at DESC)` en las migraciones revisadas. Toda las páginas del CRM filtran por `lead_id` y ordenan por `created_at desc`. Si el índice ya existe (creado manualmente en Supabase Studio) ignorar; en otro caso, se puede estar haciendo seq scan.
- **Solución propuesta:** Confirmar índices en `pg_indexes` y, si no, añadir una migración con `CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_created ON lead_activities(lead_id, created_at DESC)`. Idem para `quote_requests(lead_id, created_at DESC)`, `lead_follow_ups(lead_id)`, `sent_emails(entity_type, entity_id, sent_at DESC)`.
- **Riesgo del cambio:** Bajo — los `CREATE INDEX IF NOT EXISTS` son idempotentes.

---

## Próximos 3–5 cambios que haría primero

1. **Eliminar el N+1 con `ilike` en commission preview** (`src/app/dashboard/crm/actions.ts:3001-3011` y `2848-2856`). Reemplazar el bucle por un `.in("email", ...)` agregado, replicando lo que ya hace `comisiones/page.tsx`. Alto impacto (lo llaman comerciales en cada vista del Tracker), riesgo bajo, patrón ya validado.

2. **Fusionar las dos queries duplicadas de `user_profiles` en `equipo/page.tsx`** (líneas 121-143). Cambio de 5 líneas. Ahorra un round-trip íntegro en una página que cargan todos los managers a diario.

3. **Borrar `leadsRaw` redundante en `control/page.tsx:115-119`** y derivarlo de `allLeads`. Es la primera página que ven los managers (logo del sidebar lleva ahí). Ahorra 1 query gratis con cero riesgo.

4. **Limitar `print_jobs` en queue/control** (`queue/page.tsx:19-38`, `control/page.tsx:105`) a estados activos + `.limit(...)`. Con un taller maduro `print_jobs.done` crece sin freno y carga el dashboard interno. Cambio mecánico, sin impacto en UX.

5. **Añadir paginación / `.limit()` y deduplicar `quote_requests` y `lead_activities` en `crm/[id]/page.tsx`**. Hoy se piden tres veces `quote_requests` por el mismo `lead_id` (líneas 164, 189, 356) y dos veces `lead_activities`. Envolverlo en un helper con `cache()` de React deduplica sin tocar el streaming. Es la página más visitada del CRM.

---

_Nota: si tras aplicar estos cambios sigue habiendo lentitud percibida, vale la pena ejecutar `EXPLAIN ANALYZE` sobre los selects de `lead_activities`, `leads (email,status,created_at)` y `quote_requests (lead_id, paid_at)` para confirmar uso de índices — esa información no se puede deducir sólo del código._
