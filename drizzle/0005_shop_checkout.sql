ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "parcel_length_cm" real;
--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "parcel_width_cm" real;
--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "parcel_height_cm" real;
--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "parcel_weight_kg" real;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"quote_id" text NOT NULL UNIQUE,
	"reference" text NOT NULL UNIQUE,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_kobo" integer NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"customer" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"delivery" jsonb NOT NULL,
	"paystack_transaction_id" text,
	"paystack_authorization_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
