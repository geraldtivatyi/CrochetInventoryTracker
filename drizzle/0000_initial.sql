CREATE TABLE IF NOT EXISTS "yarns" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"color" text NOT NULL,
	"color_hex" text NOT NULL,
	"cost_per_ball" real NOT NULL,
	"quantity_in_stock" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"balls_needed" integer NOT NULL,
	"preferred_yarn_type" text,
	"time_to_make" real NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_calculations" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_name" text NOT NULL,
	"project_id" integer,
	"yarn_id" integer,
	"balls_used" integer NOT NULL,
	"additional_costs" real DEFAULT 0 NOT NULL,
	"labor_hours" real NOT NULL,
	"hourly_rate" real NOT NULL,
	"markup_percentage" real NOT NULL,
	"round_to_nearest" boolean DEFAULT false NOT NULL,
	"material_cost" real NOT NULL,
	"labor_cost" real NOT NULL,
	"base_cost" real NOT NULL,
	"markup" real NOT NULL,
	"final_price" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"description" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);