ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone text;
CREATE UNIQUE INDEX IF NOT EXISTS users_whatsapp_phone_unique
  ON users (whatsapp_phone) WHERE whatsapp_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform_integrations (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  whatsapp_phone_number_id text NOT NULL DEFAULT '',
  whatsapp_access_token_encrypted text,
  whatsapp_app_secret_encrypted text,
  whatsapp_verify_token_encrypted text,
  whatsapp_order_request_template text NOT NULL DEFAULT '',
  whatsapp_order_paid_template text NOT NULL DEFAULT '',
  whatsapp_order_receipt_template text NOT NULL DEFAULT '',
  whatsapp_tracking_template text NOT NULL DEFAULT '',
  whatsapp_pickup_template text NOT NULL DEFAULT '',
  whatsapp_template_language text NOT NULL DEFAULT 'en_ZA',
  courier_access_key_encrypted text,
  courier_secret_encrypted text,
  updated_at timestamp NOT NULL DEFAULT now()
);
INSERT INTO platform_integrations (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  message_id text PRIMARY KEY,
  created_at timestamp NOT NULL DEFAULT now()
);
