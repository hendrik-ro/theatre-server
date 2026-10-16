import session from "express-session";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/db/index.js";
import { sessions } from "../src/db/schema/sessions.sql.js";
import { SessionStore } from "../src/db/sessionStore.js";

const store = new SessionStore();

// Minimal session fixtures: express-session's Cookie type requires
// originalMaxAge, but the store only ever reads cookie.maxAge, so the
// fixtures stay small and are cast to SessionData.
type FixtureSession = { cookie?: { maxAge: number }; userId?: string };
const fixtureSession = (data: FixtureSession) =>
  data as unknown as session.SessionData;

function get(sid: string) {
  return new Promise((resolve, reject) =>
    store.get(sid, (err, sessionData) =>
      err ? reject(err) : resolve(sessionData),
    ),
  );
}

function set(sid: string, sessionData: FixtureSession) {
  return new Promise((resolve, reject) =>
    store.set(sid, fixtureSession(sessionData), (err) =>
      err ? reject(err) : resolve(null),
    ),
  );
}

function destroy(sid: string) {
  return new Promise((resolve, reject) =>
    store.destroy(sid, (err) => (err ? reject(err) : resolve(null))),
  );
}

function touch(sid: string, sessionData: FixtureSession) {
  return new Promise((resolve, reject) =>
    store.touch(sid, fixtureSession(sessionData), (err) =>
      err ? reject(err) : resolve(null),
    ),
  );
}

async function getRow(sid: string) {
  const [row] = await db.select().from(sessions).where(eq(sessions.sid, sid));
  return row;
}

describe("SessionStore", () => {
  beforeEach(async () => {
    await db.delete(sessions);
  });

  it("set then get returns the stored session data", async () => {
    await set("sid-1", { cookie: { maxAge: 60000 }, userId: "u-1" });

    const sessionData = await get("sid-1");

    expect(sessionData).toEqual({
      cookie: { maxAge: 60000 },
      userId: "u-1",
    });
  });

  it("get returns null for an unknown sid", async () => {
    const sessionData = await get("no-such-sid");

    expect(sessionData).toBeNull();
  });

  it("set on an existing sid updates the row instead of failing", async () => {
    await set("sid-1", { cookie: { maxAge: 60000 }, userId: "u-1" });
    await set("sid-1", { cookie: { maxAge: 120000 }, userId: "u-2" });

    const sessionData = await get("sid-1");

    expect(sessionData).toEqual({
      cookie: { maxAge: 120000 },
      userId: "u-2",
    });
  });

  it("get returns null for an expired session", async () => {
    await db.insert(sessions).values({
      sid: "sid-1",
      sess: fixtureSession({ cookie: { maxAge: 1000 }, userId: "u-1" }),
      expire: new Date(Date.now() - 1000),
    });

    const sessionData = await get("sid-1");

    expect(sessionData).toBeNull();
  });

  it("destroy removes the session", async () => {
    await set("sid-1", { cookie: { maxAge: 60000 }, userId: "u-1" });

    await destroy("sid-1");

    expect(await get("sid-1")).toBeNull();
    expect(await getRow("sid-1")).toBeUndefined();
  });

  it("touch extends the expiry of a live session", async () => {
    await set("sid-1", { cookie: { maxAge: 1000 }, userId: "u-1" });
    const before = (await getRow("sid-1"))!.expire;

    await touch("sid-1", { cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } });
    const after = (await getRow("sid-1"))!.expire;

    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it("touch on a missing sid recreates the row", async () => {
    await touch("sid-1", { cookie: { maxAge: 60000 }, userId: "u-1" });

    const sessionData = await get("sid-1");

    expect(sessionData).toEqual({
      cookie: { maxAge: 60000 },
      userId: "u-1",
    });
  });

  it("prune deletes expired rows and keeps live ones", async () => {
    await db.insert(sessions).values({
      sid: "expired",
      sess: fixtureSession({ cookie: { maxAge: 1000 } }),
      expire: new Date(Date.now() - 1000),
    });
    await set("live", { cookie: { maxAge: 60000 } });

    await store.prune();

    expect(await getRow("expired")).toBeUndefined();
    expect(await getRow("live")).toBeDefined();
  });
});
