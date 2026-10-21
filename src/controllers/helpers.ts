import { Request } from "express";
import { User } from "../models/users.js";

// Unreachable in a correctly wired app: the routes below all run behind
// requireAuth, which guarantees req.user. Guards the optional typing
// instead of asserting it away.
export function requireUser(req: Request): User {
  const user = req.user;
  if (!user) throw new Error("requireAuth middleware not mounted");
  return user;
}