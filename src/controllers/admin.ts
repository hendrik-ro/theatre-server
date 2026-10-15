import {
  deleteUser as deleteUserRow,
  getAllUsers,
} from "../db/queries/users.js";
import { deleteMovie as deleteMovieRow } from "../db/queries/movies.js";
import type { AsyncRequestHandler } from "../utils/asyncHandler.js";

export const listUsers: AsyncRequestHandler = async (_req, res) => {
  const all = await getAllUsers();
  res.status(200).json(all.map(({ passwordHash: _omit, ...user }) => user));
};

// Deletion is idempotent: a valid UUID that never existed still 204s.
export const deleteUser: AsyncRequestHandler = async (req, res) => {
  await deleteUserRow(req.params.id);
  res.sendStatus(204);
};

export const deleteMovie: AsyncRequestHandler = async (req, res) => {
  await deleteMovieRow(req.params.id);
  res.sendStatus(204);
};
