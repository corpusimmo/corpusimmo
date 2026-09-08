CREATE TABLE "crm_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount_cents" integer,
	"stage" text DEFAULT 'decouverte' NOT NULL,
	"owner_email" text,
	"expected_close_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"author_email" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid,
	"title" text NOT NULL,
	"assignee_email" text,
	"created_by_email" text,
	"due_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "stage" text DEFAULT 'nouveau' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "owner_email" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "origin" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_deals_stage_idx" ON "crm_deals" USING btree ("stage","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "crm_deals_contact_idx" ON "crm_deals" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "crm_notes_contact_created_idx" ON "crm_notes" USING btree ("contact_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "crm_tasks_open_due_idx" ON "crm_tasks" USING btree ("done_at","due_at");--> statement-breakpoint
CREATE INDEX "crm_tasks_contact_idx" ON "crm_tasks" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contacts_stage_idx" ON "contacts" USING btree ("stage","last_activity_at" DESC NULLS LAST);