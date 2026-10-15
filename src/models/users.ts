import { z } from "zod";

export interface User {
  id: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string;
  role: "user" | "admin";
}

// Passwords are not trimmed: spaces may be intentional, and trimming
// silently stores a hash of something else than the user typed.
export const userRegistrationSchema = z.object({
  username: z.string().trim().min(3).max(12),
  email: z.email(),
  password: z.string().min(8).max(128),
});

export const userLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});
