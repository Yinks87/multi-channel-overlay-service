import express from 'express';

// Map<res, Set<topic>> — clients only receive events they explicitly subscribed to
const clients = new Map();

// Map<overlayPath, Set<res>> — tracks live connections per overlay
const overlayClients = new Map();

export const clientV1Router = express.Router();

// Resolve which overlay a connecting client belongs to.
// Prefers an explicit ?overlay= param; falls back to the Referer header so
// existing overlay pages (e.g. /overlay-service/dropgame/gameoverlay.html)
// are tracked automatically without any code changes.
function extractOverlayPath(req) {
  const explicit = req.query.overlay;
  if (explicit) return String(explicit);

  const referer = req.headers.referer ?? req.headers.referrer ?? '';
  if (!referer) return null;
  try {
    const { pathname } = new URL(referer);
    const match = pathname.match(/^\/overlay-service(\/.*)/); // e.g. /dropgame/gameoverlay.html
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function getClientCounts() {
  const counts = {};
  console.log(overlayClients.entries());
  for (const [path, set] of overlayClients) {
    counts[path] = set.size;
  }
  return counts;
}

function broadcastClientCounts() {
  const counts = getClientCounts();
  const payload = `event: _client-counts\ndata: ${JSON.stringify(counts)}\n\n`;
  for (const [client, topics] of clients) {
    if (topics.has('_client-counts')) {
      client.write(payload);
    }
  }
}

clientV1Router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const raw = req.query.topics;
  const topics = new Set(
    raw
      ? raw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
  );

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

  const overlayPath = extractOverlayPath(req);
  if (overlayPath) {
    if (!overlayClients.has(overlayPath))
      overlayClients.set(overlayPath, new Set());
    overlayClients.get(overlayPath).add(res);
  }

  clients.set(res, topics);
  console.log('Client connected. Total clients:', clients.size);
  broadcastClientCounts();

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    if (overlayPath) {
      const set = overlayClients.get(overlayPath);
      if (set) {
        set.delete(res);
        if (set.size === 0) overlayClients.delete(overlayPath);
      }
    }
    console.log('Client disconnected. Total clients:', clients.size);
    broadcastClientCounts();
  });
});

export async function sendEventToClients({ event, data }) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [client, topics] of clients) {
    if (topics.has(event)) {
      client.write(payload);
    }
  }
}
