import type { User } from "../models/users.js";

declare global {
  namespace Express {
    interface Request {
      // Attached by requireAuth once the session's user is confirmed to
      // still exist; role checks (requireAdmin) read it instead of
      // re-querying the database.
      user?: User;
    }
  }
}

export {};
