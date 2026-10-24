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

const allowedOrigins = config.allowedOrigins.split(",").map((o) => o.trim());

// Origin validation function for CORS.
// Browser cross-origin requests ALWAYS include the Origin header and are
// validated against allowedOrigins in production. Same-origin requests and
// non-browser tools (Postman, curl) omit the Origin header and are allowed
// through — this is safe because browsers cannot forge same-origin requests.
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // No Origin header: same-origin request or non-browser tool (Postman, curl)
    // Browsers always send Origin for cross-origin requests, so missing Origin
    // means the request is same-origin (trusted) or from a development tool.
    if (!origin) {
      return callback(null, true);
    }

    // Cross-origin browser request: validate against allowed list in production
    if (config.env === "production") {
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`CORS: Blocked cross-origin request from: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    }

    // Development: allow all cross-origin requests
    callback(null, true);
  },
  credentials: true,
};

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        frameSrc: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xFrameOptions: { action: "sameorigin" },
    strictTransportSecurity: false,
  }),
);
app.use(cors(corsOptions));
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
