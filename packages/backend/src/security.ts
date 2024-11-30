function obfuscate(value: string): string {
  const takeN = value.length > 10 ? 5 : value.length > 4 ? 2 : 0;
  return takeN === 0
    ? "****"
    : `${value.slice(0, takeN)}****${value.slice(-takeN)}`;
}

export function obfuscateObject(obj: object): Record<string, unknown> {
  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (k.toLowerCase().includes("key") && typeof v === "string") {
        return [k, obfuscate(v)];
      } else if (isPlainObject(v)) {
        return [k, obfuscateObject(v)];
      } else {
        return [k, v];
      }
    }),
  );
}

export { obfuscate as obfuscateTestOnly };
