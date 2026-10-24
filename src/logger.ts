import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const REDACTED_KEYS = new Set<string>([]);

type LogFields = Record<string, unknown>;

const MAX_ENTRIES = 200;

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

  console.log(fields);

  appendFileSync(
    logPath,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      event: eventName,
      ...redact(fields),
    })}\n`,
  );

  trimLog();
}
