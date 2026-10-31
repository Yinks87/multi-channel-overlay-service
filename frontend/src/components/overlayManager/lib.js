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

export function getOverlayRoutePath(overlay) {
  if (overlay.is_protected) return overlay.route_path;
  return `/${overlay.access_key}${overlay.route_path}`;
}
