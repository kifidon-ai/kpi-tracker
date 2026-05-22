CREATE TABLE "activity_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rep_id" text NOT NULL,
	"metric_key" text NOT NULL,
	"label" text NOT NULL,
	"icon" text NOT NULL,
	"color" varchar(12) NOT NULL,
	"delta" integer DEFAULT 1 NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'Starter' NOT NULL,
	"mrr" integer DEFAULT 0 NOT NULL,
	"since_date" date DEFAULT CURRENT_DATE NOT NULL,
	"owner_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closed_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rep_id" text,
	"company_name" text NOT NULL,
	"monthly_price" double precision DEFAULT 0 NOT NULL,
	"closed_date" date DEFAULT CURRENT_DATE NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reps" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"initials" varchar(4) NOT NULL,
	"color" varchar(12) NOT NULL,
	"joined_date" date,
	"role" text DEFAULT 'SDR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	CONSTRAINT "reps_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" text NOT NULL,
	"dials" integer DEFAULT 0 NOT NULL,
	"conv" integer DEFAULT 0 NOT NULL,
	"vm" integer DEFAULT 0 NOT NULL,
	"disc" integer DEFAULT 0 NOT NULL,
	"demo" integer DEFAULT 0 NOT NULL,
	"onb" integer DEFAULT 0 NOT NULL,
	"closed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "targets_period_unique" UNIQUE("period")
);
--> statement-breakpoint
ALTER TABLE "activity_log_entries" ADD CONSTRAINT "activity_log_entries_rep_id_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."reps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_id_reps_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."reps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closed_deals" ADD CONSTRAINT "closed_deals_rep_id_reps_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."reps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_log_entries_rep" ON "activity_log_entries" USING btree ("rep_id");--> statement-breakpoint
CREATE INDEX "idx_log_entries_logged_at" ON "activity_log_entries" USING btree ("logged_at");