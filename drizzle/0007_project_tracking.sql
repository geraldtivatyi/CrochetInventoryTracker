ALTER TABLE "yarns" ADD COLUMN IF NOT EXISTS "reserved_quantity" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "yarn_id" integer;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "reserved_balls" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "balls_used" integer;
--> statement-breakpoint
UPDATE "projects" AS p
SET "yarn_id" = (
  SELECT y."id" FROM "yarns" AS y
  WHERE p."preferred_yarn_type" = y."type" || ' - ' || y."color"
     OR p."preferred_yarn_type" = y."type"
  ORDER BY CASE WHEN p."preferred_yarn_type" = y."type" || ' - ' || y."color" THEN 0 ELSE 1 END
  LIMIT 1
)
WHERE p."yarn_id" IS NULL AND p."preferred_yarn_type" IS NOT NULL;
