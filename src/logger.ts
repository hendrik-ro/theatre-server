import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const REDACTED_KEYS = new Set<string>([
  "password",
  "passwordHash",
  "token",
  "refreshToken",
  "email",
]);

type LogFields = Record<string, unknown>;

const MAX_ENTRIES = 250;

const logPath = join(process.cwd(), "data", "theatre-server.log");

function redact(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      REDACTED_KEYS.has(key) ? "[REDACTED]" : value,
    ]),
  );
}

function trimLog(): void {
  let contents: string;
  try {
    contents = readFileSync(logPath, "utf8");
  } catch {
    return;
  }

  const lines = contents.split("\n");
  if (lines[lines.length - 1] === "") lines.pop(); // trailing newline
  if (lines.length <= MAX_ENTRIES) return;

  writeFileSync(logPath, `${lines.slice(-MAX_ENTRIES).join("\n")}\n`);
}

export function logEvent(eventName: string, fields: LogFields = {}): void {
  mkdirSync(dirname(logPath), { recursive: true });

  const log = `${JSON.stringify({
    timestamp: new Date().toISOString(),
    event: eventName,
    ...redact(fields),
  })}\n`;

  appendFileSync(logPath, log);

  console.log(log);

  trimLog();
}
