import { getDb } from '../index.js';

export async function getRegisteredStreamers() {
  const db = await getDb();
  const streamers = await db.all('SELECT * FROM registered_streamers');
  return streamers;
}

export async function addRegisteredStreamer({ streamer }) {
  const db = await getDb();
  await db.run(
    'INSERT INTO registered_streamers (id, userName) VALUES (?, ?)',
    streamer.id,
    streamer.userName,
  );
  return {
    success: true,
    message: `Streamer ${streamer.userName} added to registered streamers`,
  };
}

export async function deleteRegisteredStreamer({ streamer }) {
  const db = await getDb();
  await db.run('DELETE FROM registered_streamers WHERE id = ?', streamer.id);
  return {
    success: true,
    message: `Streamer ${streamer.userName} removed from registered streamers`,
  };
}

export async function updateRegisteredStreamer({ streamer, newStreamer }) {
  const db = await getDb();
  await db.run(
    'UPDATE registered_streamers SET userName = ? WHERE id = ?',
    newStreamer.userName,
    streamer.id,
  );
  return {
    success: true,
    message: `Streamer ${streamer.userName} updated to ${newStreamer.userName}`,
  };
}
