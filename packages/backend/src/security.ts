function obfuscate(value: string): string {
  return `${value.slice(0, Math.ceil(value.length / 2))}****${value.slice(-Math.floor(value.length / 2))}`;
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

// export { obfuscate as obfuscateTestOnly };
