import { pathToFileURL } from "node:url";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticateJWT } from "./middleware/authenticateJWT.js";
import { config } from "./config.js";
import { closeDB, db } from "./db/index.js";
import adminRouter from "./routes/admin.js";
import movieRouter from "./routes/movies.js";
import userRouter from "./routes/users.js";
import watchlistsRouter from "./routes/watchlists.js";
import movieRatingsRouter from "./routes/movieRatings.js";
import { movies } from "./db/schema/movies.sql.js";
import { count } from "drizzle-orm";
import cors from "cors";

const app = express();
const port = config.serverPort;

const allowedOrigins = config.allowedOrigins.split(",");
app.use(
  cors({
    origin: config.env === "production" ? allowedOrigins : "*",
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json({ limit: "16kb" }));
// Attaches req.user from an access token when present; never rejects.
// requireAuth enforces authentication per route.
app.use(authenticateJWT);

app.use("/api/movies", movieRouter);
app.use("/api/users", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/watchlists", watchlistsRouter);
app.use("/api/ratings", movieRatingsRouter);

app.get("/api/health", async (_req, res) => {
  try {
    await db.select({ count: count() }).from(movies);
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

// JSON 404 for unknown /api routes
// Express would otherwise send its HTML page
app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

function startServer() {
  const server = app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });

  function shutdown(signal: NodeJS.Signals) {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      // The pool close failing must not turn the exit code nonzero —
      // an unhandled rejection here would exit(1), which docker/k8s
      // read as a crash. Revisit before deployment.
      await closeDB().catch((err) => {
        console.error("DB close error:", err);
      });
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5_000).unref();
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Start only when run as the entry point; importing the app (tests)
// must not open a port.
const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) startServer();

export { app };
