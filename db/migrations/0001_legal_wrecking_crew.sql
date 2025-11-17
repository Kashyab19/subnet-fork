-- Drop the primary key constraint first
ALTER TABLE "agents" DROP CONSTRAINT IF EXISTS "agents_pkey";--> statement-breakpoint
-- Drop the identity constraint
ALTER TABLE "agents" ALTER COLUMN "id" DROP IDENTITY IF EXISTS;--> statement-breakpoint
-- Add a temporary UUID column
ALTER TABLE "agents" ADD COLUMN "id_new" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
-- Copy data if any exists (generate new UUIDs for existing rows)
UPDATE "agents" SET "id_new" = gen_random_uuid() WHERE "id_new" IS NULL;--> statement-breakpoint
-- Drop the old column
ALTER TABLE "agents" DROP COLUMN "id";--> statement-breakpoint
-- Rename the new column
ALTER TABLE "agents" RENAME COLUMN "id_new" TO "id";--> statement-breakpoint
-- Set as primary key
ALTER TABLE "agents" ADD PRIMARY KEY ("id");--> statement-breakpoint
-- Set default for future inserts
ALTER TABLE "agents" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "tools" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "tools" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "parent_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "share_id" varchar(50);--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_share_id_unique" UNIQUE("share_id");