import express from 'express';

// Map<res, Set<topic>> — clients only receive events they explicitly subscribed to
const clients = new Map();

export const clientV1Router = express.Router();

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

  clients.set(res, topics);
  console.log('Client connected. Total clients:', clients.size);
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    console.log('Client disconnected. Total clients:', clients.size);
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
