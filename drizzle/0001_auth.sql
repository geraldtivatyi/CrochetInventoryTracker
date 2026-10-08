CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"otp_enabled" boolean DEFAULT false NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
