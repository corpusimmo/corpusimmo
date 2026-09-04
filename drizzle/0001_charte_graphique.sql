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
--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;