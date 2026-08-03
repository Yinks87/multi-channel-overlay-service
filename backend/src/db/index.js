import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { runMigrations } from './migrations.js';

let db = null;

/**
 * Creates or opens the SQLite database at the specified path.
 * Run migrations after opening the database to ensure the schema is up to date.
 *
 * @param {string} dbPath - Absolute path to the .db file | default: './db.sqlite'
 * @returns {Promise<import('sqlite').Database>}
 */
export async function openDb(dbPath = path.join(path.resolve(), 'db.sqlite')) {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // WAL mode for better performance and concurrency
  await db.exec('PRAGMA journal_mode = WAL;');
  await db.run(`PRAGMA foreign_keys = ON;`);

  await runMigrations(db);

  return db;
}

/**
 * Returns the current database instance.
 * Throws an error if openDatabase() has not been called yet.
 *
 * @returns {import('sqlite').Database}
 */
export async function getDb() {
  if (!db) {
    throw new Error('Database connection is not open. Call openDb() first.');
  }
  return db;
}

/**
 * Closes the database connection and resets the instance.
 */
export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}

/**
 *
 * @param {string} tableName - The name of the sqlite table
 * @param {Array<{name: string, properties: string}>} columns - An array of objects representing the columns of the table, where each object has a `name` and `properties` (e.g., type, constraints)
 * ```javascript
 * const columns = [
 *   { name: 'id', properties: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
 *   { name: 'name', properties: 'TEXT NOT NULL' },
 *   { name: 'age', properties: 'INTEGER' },
 * ];
 * const createTableSQL = createNewTable('users', columns);
 * console.log(createTableSQL);
 * // Output: CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, age INTEGER)
 * ```
 * @returns {string} SQL statement to create the specified table
 */

export function createNewTable(tableName, columns = []) {
  if (!tableName || typeof tableName !== 'string') {
    throw new Error('Table name must be a non-empty string');
  }
  if (!Array.isArray(columns)) {
    throw new Error('Columns must be an array');
  }
  const columnDefinitions = columns
    .map(({ name: columnName, properties: columnProperties }) => {
      if (typeof columnName !== 'string' || !columnName.trim()) {
        throw new Error(
          `Column name must be a non-empty string. Invalid column name: ${columnName}`,
        );
      }
      if (typeof columnProperties !== 'string' || !columnProperties.trim()) {
        throw new Error(
          `Column type must be a non-empty string. Invalid column type for column ${columnName}: ${columnProperties}`,
        );
      }
      return `${columnName} ${columnProperties}`;
    })
    .join(', ');

  const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefinitions})`;
  return createTableSQL;
}

/**
 *
 * @param {string} tableName
 * @returns {string} SQL statement to drop the specified table
 */
export function dropTable(tableName) {
  if (!tableName || typeof tableName !== 'string') {
    throw new Error('Table name must be a non-empty string');
  }
  const dropTableSQL = `DROP TABLE IF EXISTS ${tableName}`;
  return dropTableSQL;
}
