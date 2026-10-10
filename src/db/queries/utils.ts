export function firstOrUndefined<T>(items: T[]) {
  if (items.length === 0) {
    return;
  }
  return items[0];
}

type UUID = string & { __brand: "uuid" };

export function isUUID(s: string): s is UUID {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}
