ALTER TABLE "movie_ratings" DROP CONSTRAINT "user_movie_ratings_range";--> statement-breakpoint
ALTER TABLE "movies" DROP CONSTRAINT "imdb_rating_range";--> statement-breakpoint
ALTER TABLE "movies" DROP COLUMN "imdb_rating";--> statement-breakpoint
ALTER TABLE "movie_ratings" ADD CONSTRAINT "user_movie_ratings_range" CHECK ("movie_ratings"."rating" >= 1 AND "movie_ratings"."rating" <= 10);