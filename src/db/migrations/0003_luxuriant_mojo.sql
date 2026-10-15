ALTER TABLE "users" RENAME COLUMN "name" TO "username";--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "users_name_unique" TO "users_username_unique";
