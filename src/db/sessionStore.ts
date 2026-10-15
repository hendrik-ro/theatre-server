import session from "express-session";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "./index.js";
import { sessions } from "./schema/sessions.sql.js";

// Single source for the session lifetime: the cookie maxAge set by the
// session middleware, and the fallback TTL for session data that carries
// no maxAge (e.g. hand-built in tests).
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function expiryDate(sessionData: session.SessionData): Date {
  const maxAge = sessionData.cookie?.maxAge;
  return new Date(
    Date.now() + (typeof maxAge === "number" ? maxAge : SESSION_MAX_AGE_MS),
  );
}

// express-session store backed by the app's postgres-js / Drizzle stack.
// Serializes the session as jsonb, so values must be JSON-encodable.
export class SessionStore extends session.Store {
  get(
    sid: string,
    callback: (
      err: Error | null,
      sessionData?: session.SessionData | null,
    ) => void,
  ): void {
    db.select({ sess: sessions.sess })
      .from(sessions)
      .where(and(eq(sessions.sid, sid), gt(sessions.expire, new Date())))
      .then((rows) => callback(null, rows[0]?.sess ?? null))
      .catch((err: Error) => callback(err));
  }

  set(
    sid: string,
    sessionData: session.SessionData,
    callback: (err?: Error | null) => void,
  ): void {
    const expire = expiryDate(sessionData);
    db.insert(sessions)
      .values({ sid, sess: sessionData, expire })
      .onConflictDoUpdate({
        target: sessions.sid,
        set: { sess: sessionData, expire },
      })
      .then(() => callback())
      .catch((err: Error) => callback(err));
  }

  touch(
    sid: string,
    sessionData: session.SessionData,
    callback: (err?: Error | null) => void,
  ): void {
    const expire = expiryDate(sessionData);
    db.update(sessions)
      .set({ expire })
      .where(and(eq(sessions.sid, sid), gt(sessions.expire, new Date())))
      .returning({ sid: sessions.sid })
      .then((rows) => {
        // The row expired between the read and this write; recreate it so
        // a still-valid browser cookie does not lose its session.
        if (rows.length === 0) {
          this.set(sid, sessionData, callback);
          return;
        }
        callback();
      })
      .catch((err: Error) => callback(err));
  }

  destroy(sid: string, callback: (err?: Error | null) => void): void {
    db.delete(sessions)
      .where(eq(sessions.sid, sid))
      .then(() => callback())
      .catch((err: Error) => callback(err));
  }

  // Not part of the express-session Store API; called on a timer from
  // server.ts so expired rows do not accumulate.
  async prune(): Promise<void> {
    await db.delete(sessions).where(lt(sessions.expire, new Date()));
  }
}

export const sessionStore = new SessionStore();
