export function normalizeParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(
      ([key]) => typeof key === 'string' && key.trim(),
    ),
  );
}
