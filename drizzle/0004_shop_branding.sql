ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "theme_color" text NOT NULL DEFAULT '#6b4f3f';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_branding_images" (
	"shop_id" integer PRIMARY KEY NOT NULL,
	"image_data" bytea NOT NULL,
	"image_mime_type" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
