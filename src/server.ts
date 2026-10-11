import express from "express";
import helmet from "helmet";
import router from "./routes/movies.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { config } from "./config.js";

const app = express();
const port = config.serverPort;

app.use(helmet());
app.use(express.json());

app.use("/api/movies", router);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

function shutdown(signal: NodeJS.Signals) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
