ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "whatsapp_phone_number_id" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "whatsapp_access_token_encrypted" text;
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "whatsapp_order_template" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "whatsapp_tracking_template" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "whatsapp_reminder_template" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "whatsapp_template_language" text NOT NULL DEFAULT 'en_ZA';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_jobs" (
  "id" serial PRIMARY KEY NOT NULL,
  "dedupe_key" text NOT NULL UNIQUE,
  "shop_id" integer NOT NULL,
  "order_reference" text NOT NULL,
  "channel" text NOT NULL,
  "kind" text NOT NULL,
  "recipient" text NOT NULL,
  "payload" jsonb NOT NULL,
  "run_at" timestamp NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
