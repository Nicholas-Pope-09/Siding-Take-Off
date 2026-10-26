CREATE TABLE "takeoff_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"runAt" text NOT NULL,
	"sectionKey" text NOT NULL,
	"pageName" text NOT NULL,
	"elevation" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"outcome" text NOT NULL,
	"confidence" text,
	"model" text NOT NULL,
	"scale" real,
	"scaleSource" text,
	"original" jsonb,
	"final" jsonb,
	"metrics" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "takeoff_corrections_project_run_idx" ON "takeoff_corrections" USING btree ("projectId","runAt");