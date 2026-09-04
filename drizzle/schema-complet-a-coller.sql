-- ═══════════════════════════════════════════════════════════════════════════
--  CORPUSIMMO · schéma complet, à coller dans l'éditeur SQL de Neon
--
--  Ce fichier fait exactement ce que ferait `pnpm db:migrate`, y compris la
--  tenue du registre : Drizzle note dans `drizzle.__drizzle_migrations` ce
--  qu'il a déjà appliqué, pour ne jamais rejouer deux fois la même migration.
--  Sans ces deux dernières lignes, une future migration essaierait de créer
--  des tables déjà présentes et échouerait.
--
--  À exécuter UNE SEULE FOIS, sur une base vide.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

-- ── 0000_socle_persistance ──────────────────────────────────────
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);

CREATE TABLE "comparable_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"transaction_id" text NOT NULL,
	"transaction" jsonb NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"manual_weight" double precision,
	"comment" text
);

CREATE TABLE "comparable_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"subject" jsonb,
	"estimation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text,
	"purpose" text NOT NULL,
	"granted" boolean NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"version" integer NOT NULL
);

CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "estimation_results" (
	"estimation_id" uuid PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_version" integer DEFAULT 1 NOT NULL,
	"stored_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "estimations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"engine_id" text NOT NULL,
	"method" text NOT NULL,
	"status" text NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"address_label" text NOT NULL,
	"city" text NOT NULL,
	"postcode" text,
	"city_code" text,
	"department_code" text,
	"property_type" text NOT NULL,
	"surface" double precision DEFAULT 0 NOT NULL,
	"value_low" integer,
	"value_central" integer,
	"value_high" integer,
	"price_per_sqm" integer,
	"confidence" integer NOT NULL,
	"comparables_count" integer NOT NULL,
	"share_token" text,
	CONSTRAINT "estimations_share_token_unique" UNIQUE("share_token")
);

CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"estimation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"source" text NOT NULL,
	"property_type" text,
	"city" text,
	"city_code" text,
	"postcode" text,
	"living_area" double precision,
	"intent" text,
	"estimated_low" integer,
	"estimated_high" integer,
	"score" integer NOT NULL,
	"score_breakdown" jsonb
);

CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);

CREATE TABLE "tool_unlocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tool_slug" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "comparable_items" ADD CONSTRAINT "comparable_items_set_id_comparable_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."comparable_sets"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "comparable_sets" ADD CONSTRAINT "comparable_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "comparable_sets" ADD CONSTRAINT "comparable_sets_estimation_id_estimations_id_fk" FOREIGN KEY ("estimation_id") REFERENCES "public"."estimations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "estimation_results" ADD CONSTRAINT "estimation_results_estimation_id_estimations_id_fk" FOREIGN KEY ("estimation_id") REFERENCES "public"."estimations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "estimations" ADD CONSTRAINT "estimations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "leads" ADD CONSTRAINT "leads_estimation_id_estimations_id_fk" FOREIGN KEY ("estimation_id") REFERENCES "public"."estimations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tool_unlocks" ADD CONSTRAINT "tool_unlocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");
CREATE UNIQUE INDEX "comparable_items_set_transaction_idx" ON "comparable_items" USING btree ("set_id","transaction_id");
CREATE INDEX "comparable_items_set_added_at_idx" ON "comparable_items" USING btree ("set_id","added_at");
CREATE INDEX "comparable_sets_user_updated_at_idx" ON "comparable_sets" USING btree ("user_id","updated_at" DESC NULLS LAST);
CREATE INDEX "consents_email_purpose_idx" ON "consents" USING btree ("email","purpose","collected_at" DESC NULLS LAST);
CREATE INDEX "consents_user_collected_at_idx" ON "consents" USING btree ("user_id","collected_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");
CREATE INDEX "contacts_user_id_idx" ON "contacts" USING btree ("user_id");
CREATE INDEX "estimations_user_computed_at_idx" ON "estimations" USING btree ("user_id","computed_at" DESC NULLS LAST);
CREATE UNIQUE INDEX "estimations_user_engine_id_idx" ON "estimations" USING btree ("user_id","engine_id");
CREATE INDEX "leads_status_created_at_idx" ON "leads" USING btree ("status","created_at" DESC NULLS LAST);
CREATE INDEX "leads_contact_id_idx" ON "leads" USING btree ("contact_id");
CREATE INDEX "leads_estimation_id_idx" ON "leads" USING btree ("estimation_id");
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires");
CREATE UNIQUE INDEX "tool_unlocks_user_tool_idx" ON "tool_unlocks" USING btree ("user_id","tool_slug");
CREATE INDEX "tool_unlocks_user_unlocked_at_idx" ON "tool_unlocks" USING btree ("user_id","unlocked_at" DESC NULLS LAST);
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens" USING btree ("expires");
-- ── 0001_charte_graphique ───────────────────────────────────────
CREATE TABLE "brand_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"company_name" text,
	"website" text,
	"logo_url" text,
	"primary_color" text,
	"secondary_color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
-- ── Registre des migrations appliquées ──────────────────────────────────────
INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES
  ('edbe2ce5da1221c6e2f7624cece8401f51da73d7ac0134298e5bd53cfda34a88', 1788283395080),
  ('c401b48a5665922adbeff33157ab4cdf674e862d6d6de2cffde2d19c77153198', 1788503085058);
