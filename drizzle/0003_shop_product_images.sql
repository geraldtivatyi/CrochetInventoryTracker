ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "image_data" bytea;
--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "image_mime_type" text;
