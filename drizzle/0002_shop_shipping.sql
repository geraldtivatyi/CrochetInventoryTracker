CREATE TABLE IF NOT EXISTS "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL UNIQUE,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_live" boolean DEFAULT false NOT NULL,
	"custom_domain" text UNIQUE,
	"collection_enabled" boolean DEFAULT true NOT NULL,
	"courier_enabled" boolean DEFAULT false NOT NULL,
	"lockers_enabled" boolean DEFAULT false NOT NULL,
	"origin_address" jsonb NOT NULL,
	"sender_name" text NOT NULL,
	"sender_email" text NOT NULL,
	"sender_phone" text NOT NULL,
	"courier_access_key_encrypted" text,
	"courier_secret_encrypted" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" real NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
