import type { User } from "../models/users.js";

declare global {
  namespace Express {
    interface Request {
      // Attached by authenticateJWT when a valid access token is present
      // and the user still exists; role checks (requireAdmin) read it
      // instead of re-querying the database.
      user?: User;
    }
  }
}

export {};
