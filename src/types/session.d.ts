// Express-session only knows its built-in SessionData shape; this makes
// the app's custom session field visible to TypeScript. The import makes
// the file a module, so the declaration augments rather than shadows the
// express-session types.
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}
