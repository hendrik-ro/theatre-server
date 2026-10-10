export interface Movie {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  year: number | null;
  runtime: number | null;
  imdbRating: number | null;
  genre: string | null;
}
