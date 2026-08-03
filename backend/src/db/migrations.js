const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (db) => {
      await db.exec('PRAGMA journal_mode = WAL;');
      await db.exec('PRAGMA busy_timeout = 5000;');

      await db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings(
        id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        scope TEXT NOT NULL
        );
      `);

      await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        userName TEXT NOT NULL UNIQUE,
        normalizedUserName TEXT NOT NULL UNIQUE,
        twitch TEXT,
        token TEXT,
        roles TEXT NOT NULL DEFAULT '[]',
        moderatedChannels TEXT NOT NULL DEFAULT '[]',
        connected NUMBER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
    `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS overlays (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          route_path TEXT NOT NULL UNIQUE,
          folder_path TEXT NOT NULL,
          entry_file TEXT NOT NULL,
          params TEXT NOT NULL DEFAULT '{}',
          notes TEXT NOT NULL DEFAULT '',
          streamer_ids TEXT NOT NULL DEFAULT '[]',
          overlay_type TEXT NOT NULL DEFAULT '["streamer"]',
          width INTEGER NOT NULL DEFAULT 800,
          height INTEGER NOT NULL DEFAULT 600,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );
      `);
    },
  },

  // Example of a future migration:
  // {
  //   version: 2,
  //   name: 'release_name',
  //   up: async (db) => {
  //     // Safe: only runs on existing DBs that predate the notes column
  //     await db.exec(
  //       `ALTER TABLE <TABLE> ADD COLUMN <COLUMNNAME> TEXT NOT NULL DEFAULT '[]'`,
  //     );
  //     await db.exec(
  //       `ALTER TABLE <TABLE> ADD COLUMN <COLUMNNAME> TEXT NOT NULL DEFAULT '[]'`,
  //     );
  //   },
  // },
];

/**
 * Runs all pending migrations.
 * Stores the current schema version in the user_version PRAGMA.
 *
 * @param {import('sqlite').Database} db
 */

export async function runMigrations(db) {
  const row = await db.get('PRAGMA user_version;');
  const currentVersion = row.user_version;

  const pending = migrations.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  for (const migration of pending) {
    console.log(
      `[DB] Running migration ${migration.version}: ${migration.name}`,
    );
    await migration.up(db);
    await db.run(`PRAGMA user_version = ${migration.version}`);
  }

  console.log(`[DB] Schema is now at version ${pending.at(-1).version}`);
}
