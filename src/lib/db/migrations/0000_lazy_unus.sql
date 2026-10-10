CREATE TABLE "movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"year" integer,
	"runtime" integer,
	"imdb_rating" integer,
	"genre" text,
	CONSTRAINT "movies_name_unique" UNIQUE("name")
);
