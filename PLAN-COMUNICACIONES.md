# Plan: Comunicaciones unificadas Lead → Proyecto

## Flujo de negocio real

```
1. LEAD         → Cliente contacta (email a info@, WhatsApp, formulario web)
2. NEGOCIACIÓN  → Conversaciones por email/WhatsApp, notas internas
3. PRESUPUESTO  → Se crea presupuesto en Holded
4. PROFORMA     → Cliente aprueba → factura proforma en Holded → PROYECTO PRÓXIMO
5. PAGO 50%     → Factura definitiva en Holded → PROYECTO CONFIRMADO
6. PRODUCCIÓN   → Se gestiona el proyecto en Prototipalo
```

## Estado actual

| Qué tenemos | Cómo funciona |
|---|---|
| CRM con leads | Webflow form + creación manual |
| Email entrante | n8n (IMAP) → webhook → `lead_activities` |
| Email saliente | Gmail SMTP via nodemailer |
| Hilo de email | Visible en detalle del lead |
| Sync Holded | Proformas → proyectos próximos, facturas → proyectos confirmados |
| Proyectos | Tienen `holded_contact_id` pero NO tienen `lead_id` |
| WhatsApp | Solo en GoHighLevel (goghl.ai), fuera de Prototipalo |
| Comunicación en proyecto | No existe, solo se ve info de producción |

## Lo que falta

1. **Vínculo Lead → Proyecto** (el lead desaparece cuando se crea el proyecto)
2. **WhatsApp en Prototipalo** (leer y responder desde la app)
3. **Timeline unificado en proyecto** (ver conversaciones de negociación + producción)
4. **Lead automático desde email** (si llega email a info@ y no hay lead, crear uno)

---

## Fase 1: Vínculo Lead ↔ Proyecto

### Objetivo
Que desde un proyecto se pueda acceder a todo el historial de negociación del lead.

### Cambios en base de datos
```sql
-- Añadir referencia al lead en proyectos
ALTER TABLE projects ADD COLUMN lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

-- Añadir campo holded_contact_id en leads para matching automático
ALTER TABLE leads ADD COLUMN holded_contact_id TEXT;
```

### Lógica de vinculación automática
Cuando se sincroniza una proforma desde Holded y se crea un proyecto:
1. Se busca un lead con el mismo email que el contacto de Holded
2. Si hay match → se asigna `lead_id` al proyecto y se marca el lead como "won"
3. Si no hay match → el proyecto se crea sin lead (como ahora)

Modificar `src/lib/holded/sync.ts`:
- Después de crear proyecto, buscar lead por email del contacto Holded
- Si existe, actualizar `projects.lead_id` y `leads.status = "won"`

### UI: Vista en proyecto
En `/dashboard/projects/[id]`:
- Si el proyecto tiene `lead_id`, mostrar pestaña/sección "Negociación"
- Dentro: timeline de actividades del lead (emails, notas, cambios de estado)
- Link directo al lead para ver detalle completo

### UI: Vista en lead
En `/dashboard/crm/[id]`:
- Si el lead tiene proyecto(s) asociados, mostrar sección "Proyectos"
- Link directo al proyecto

### Vinculación manual
- Desde el detalle del proyecto, botón "Vincular lead" → buscador de leads
- Desde el detalle del lead (cuando pasa a "won"), botón "Crear proyecto" o "Vincular proyecto existente"

---

## Fase 2: WhatsApp via goghl.ai + n8n

### Objetivo
Leer y responder WhatsApp desde Prototipalo, usando goghl.ai como puente.

### Arquitectura
```
ENTRANTE:
WhatsApp → goghl.ai → n8n workflow → POST /api/webhooks/whatsapp-received → lead_activities

SALIENTE:
Prototipalo → POST a n8n webhook → n8n workflow → goghl.ai → WhatsApp
```

### Cambios en base de datos
```sql
-- Nuevo tipo de actividad (ya soportado por el campo texto, solo documentar)
-- activity_type: "whatsapp_sent" | "whatsapp_received"

-- Añadir teléfono normalizado para matching
ALTER TABLE leads ADD COLUMN phone_normalized TEXT;
-- Trigger o función para normalizar al insertar/actualizar
```

### Nuevo endpoint: Webhook WhatsApp entrante
`POST /api/webhooks/whatsapp-received`

```typescript
// Recibe de n8n:
{
  from: "+34612345678",
  from_name: "Juan García",
  body: "Hola, quería preguntar por...",
  message_id: "wamid.xxx",
  timestamp: "2026-02-13T10:00:00Z",
  media_url?: "https://..." // si envían foto/doc
}

// Lógica:
// 1. Buscar lead por phone_normalized
// 2. Si no existe → crear lead automáticamente (source: "whatsapp")
// 3. Crear lead_activity (activity_type: "whatsapp_received")
// 4. Push notification al equipo
```

### Envío de WhatsApp desde Prototipalo
Nueva server action `sendLeadWhatsApp()`:
1. Recibe lead_id, mensaje, teléfono destino
2. Hace POST al webhook de n8n que envía via goghl.ai
3. Crea `lead_activity` con `activity_type: "whatsapp_sent"`

### Configuración n8n necesaria
1. **Workflow entrante:** goghl.ai trigger → HTTP Request a `/api/webhooks/whatsapp-received`
2. **Workflow saliente:** Webhook trigger (desde Prototipalo) → nodo goghl.ai → enviar mensaje

### UI: Chat unificado en lead
Actualizar `email-thread.tsx` → renombrar a `conversation-thread.tsx`:
- Mostrar emails Y WhatsApp en el mismo timeline
- Iconos distintos para cada canal (email vs WhatsApp)
- Formulario de respuesta con selector de canal (email / WhatsApp)
- Soporte para multimedia (fotos recibidas por WhatsApp)

---

## Fase 3: Lead automático desde email

### Objetivo
Si llega un email a info@prototipalo.com y no existe lead con ese email, crear uno automáticamente.

### Cambios
Modificar `/api/webhooks/email-received`:
- Si no encuentra lead por email → **crear lead** (en vez de devolver 404)
- `source: "email"`, `status: "new"`
- Crear la actividad `email_received` vinculada al nuevo lead
- Push notification: "Nuevo lead desde email"

Esto es un cambio pequeño pero de alto impacto: ningún email se pierde.

---

## Fase 4: Timeline unificado en proyecto

### Objetivo
Desde la vista de un proyecto ver TODA la comunicación relevante.

### Implementación
En `/dashboard/projects/[id]`, nueva pestaña "Comunicaciones":

**Si tiene lead vinculado:**
- Todas las actividades del lead (emails, WhatsApp, notas, cambios estado)
- Separador visual "── Negociación ──" / "── Producción ──"

**Comunicaciones propias del proyecto** (futuro):
- Notas de producción
- Comunicaciones con el cliente sobre entregas

### Componente reutilizable
Crear `<ActivityTimeline>` que se usa tanto en:
- `/dashboard/crm/[id]` (vista de lead)
- `/dashboard/projects/[id]` (vista de proyecto, pestaña comunicaciones)

---

## Orden de implementación recomendado

| Paso | Qué | Impacto | Esfuerzo |
|------|-----|---------|----------|
| **1a** | Migración BD: `lead_id` en projects | Base para todo | Bajo |
| **1b** | Vinculación auto en sync Holded | Leads se conectan con proyectos | Medio |
| **1c** | UI: ver historial del lead en proyecto | Acceso a negociación | Medio |
| **2a** | Lead auto desde email (cambiar 404 → crear) | No se pierden emails | Bajo |
| **2b** | Webhook WhatsApp entrante + n8n | Recibir WhatsApp | Medio |
| **2c** | Envío WhatsApp desde Prototipalo + n8n | Responder WhatsApp | Medio |
| **2d** | UI: chat unificado (email + WhatsApp) | Todo en un sitio | Medio |
| **3** | Timeline en proyecto | Vista completa | Medio |

### Dependencias
```
1a → 1b → 1c
         ↘
2a ──────→ 2d → 3
2b → 2c ↗
```

---

## Variables de entorno nuevas

```env
# WhatsApp via n8n
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.example.com/webhook/whatsapp-send
WHATSAPP_WEBHOOK_SECRET=xxx

# Holded contacts API (para buscar email del contacto)
# Ya existe: HOLDED_API_KEY
```

## Notas técnicas

- **Matching lead↔proyecto:** Por `holded_contact_id` o por email. El `holded_contact_id` es más fiable porque viene de Holded. Para leads que llegaron por email/WhatsApp, necesitamos buscar el contacto de Holded que tiene el mismo email.
- **goghl.ai no es API oficial de Meta:** Usa WhatsApp Web internamente. Esto funciona pero puede tener limitaciones de fiabilidad. Para volumen alto, considerar migrar a la API oficial de WhatsApp Business en el futuro.
- **n8n como middleware:** Toda la comunicación WhatsApp pasa por n8n, lo cual da flexibilidad para cambiar de proveedor sin tocar código de Prototipalo.
