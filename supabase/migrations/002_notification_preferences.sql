-- Notification system: event config + user preferences
-- Run this migration in the Supabase SQL editor

-- 1. Admin config: which roles/users receive each event type
CREATE TABLE IF NOT EXISTS notification_event_config (
  event_type TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  target_user_ids UUID[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Per-user preferences: opt out of specific events
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL REFERENCES notification_event_config(event_type) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_type)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_notif_prefs_user ON user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notif_prefs_event ON user_notification_preferences(event_type);

-- Seed default event types
INSERT INTO notification_event_config (event_type, label, description, category, target_roles) VALUES
  ('new_lead',            'Nuevo lead',                'Un nuevo lead llega desde el formulario web',          'CRM',           '{"super_admin","manager","comercial","employee"}'),
  ('email_received',      'Email recibido',            'Se recibe un email nuevo en la bandeja compartida',    'Comunicación',  '{"super_admin","manager","comercial","employee"}'),
  ('whatsapp_received',   'WhatsApp recibido',         'Se recibe un mensaje de WhatsApp',                     'Comunicación',  '{"super_admin","manager","comercial","employee"}'),
  ('task_assigned',       'Tarea asignada',            'Te asignan una nueva tarea',                           'Tareas',        '{"super_admin","manager","comercial","employee"}'),
  ('task_completed',      'Tarea completada',          'Una tarea que creaste ha sido completada',              'Tareas',        '{"super_admin","manager","comercial","employee"}'),
  ('improvement_request', 'Solicitud de mejora',       'Se crea una nueva solicitud de mejora',                 'Solicitudes',   '{"super_admin","manager","comercial","employee"}'),
  ('request_accepted',    'Solicitud aceptada',        'Tu solicitud de mejora ha sido aceptada',              'Solicitudes',   '{"super_admin","manager","comercial","employee"}'),
  ('request_rejected',    'Solicitud rechazada',       'Tu solicitud de mejora ha sido rechazada',             'Solicitudes',   '{"super_admin","manager","comercial","employee"}'),
  ('request_resolved',    'Solicitud resuelta',        'Tu solicitud de mejora ha sido resuelta',              'Solicitudes',   '{"super_admin","manager","comercial","employee"}'),
  ('purchase_request',    'Solicitud de compra',       'Se solicita la compra de un artículo',                 'Compras',       '{"super_admin","manager"}'),
  ('purchase_processed',  'Compra procesada',          'Tu solicitud de compra ha sido procesada',             'Compras',       '{"super_admin","manager","comercial","employee"}'),
  ('proforma_accepted',   'Proforma aceptada',         'Un cliente ha aceptado una proforma',                  'Proyectos',     '{"super_admin","manager","comercial","employee"}'),
  ('new_order',           'Nuevo pedido',              'Se ha recibido un nuevo pedido (factura)',              'Proyectos',     '{"super_admin","manager","comercial","employee"}'),
  ('new_project',         'Nuevo proyecto',            'Se ha creado un nuevo proyecto',                       'Proyectos',     '{"super_admin","manager","comercial","employee"}'),
  ('shipment_update',     'Actualización de envío',    'Un envío ha cambiado de estado',                       'Envíos',        '{"super_admin","manager","comercial","employee"}'),
  ('printer_alert',       'Alerta de impresora',       'Una impresora requiere atención',                      'Impresoras',    '{"super_admin","manager","comercial","employee"}'),
  ('payment_received',    'Pago recibido',             'Un cliente ha realizado un pago por Stripe',           'Ventas',        '{"super_admin","manager","comercial"}')
ON CONFLICT (event_type) DO NOTHING;

-- RLS policies
ALTER TABLE notification_event_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Event config: anyone can read, only managers+ can update
CREATE POLICY "Anyone can read event config"
  ON notification_event_config FOR SELECT
  USING (true);

CREATE POLICY "Managers can update event config"
  ON notification_event_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'super_admin')
      AND is_active = true
    )
  );

-- User preferences: users manage their own
CREATE POLICY "Users can read own preferences"
  ON user_notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON user_notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own preferences"
  ON user_notification_preferences FOR DELETE
  USING (user_id = auth.uid());

-- Service role bypass (for server actions)
CREATE POLICY "Service role full access event config"
  ON notification_event_config FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access user prefs"
  ON user_notification_preferences FOR ALL
  USING (auth.role() = 'service_role');
