import { randomUUID } from 'crypto';
import { getDb } from '../index.js';
import { sendEventToClients } from '../../router/api-v1/overlay/client-v1.js';

export async function createCustomDbTable({ tableName, schema }) {
  const db = await getDb();

  await db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (${schema})`);

  return tableName;
}

export async function getCustomDbTables() {
  const db = await getDb();
  const tables = await db.all(
    `SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT IN ('overlays', 'users', 'sqlite_sequence')
    `,
  );
  return tables.map((table) => table.name);
}

// Get all tables — protected (dashboard use only for owner)
export async function getAllTables() {
  const db = await getDb();
  const tables = await db.all(
    `SELECT name FROM sqlite_master WHERE type='table'`,
  );
  return tables.map((t) => t.name);
}

export async function deleteCustomDbTable({ tableName }) {
  const db = await getDb();
  await db.run(`DROP TABLE IF EXISTS ${tableName}`);
  return { success: true, message: `Table ${tableName} deleted successfully` };
}

export async function getDataFromCustomDbTable({ tableName }) {
  const db = await getDb();
  // __rowid__ is used as a reliable fallback key when no PK is defined
  const data = await db.all(`SELECT rowid AS __rowid__, * FROM ${tableName}`);
  return data;
}

export async function getRowFromCustomDbTable({ tableName, key, keyValue }) {
  const db = await getDb();
  const row = await db.get(
    `SELECT rowid AS __rowid__, * FROM ${tableName} WHERE ${key} = ?`,
    keyValue,
  );
  return row;
}

export async function getTableSchema(tableName) {
  const db = await getDb();
  const columns = await db.all(`PRAGMA table_info(${tableName})`);

  // Collect unique column names from unique indexes
  const indexList = await db.all(`PRAGMA index_list(${tableName})`);
  const uniqueColumns = new Set();
  for (const idx of indexList) {
    if (idx.unique) {
      const indexInfo = await db.all(`PRAGMA index_info(${idx.name})`);
      indexInfo.forEach((c) => uniqueColumns.add(c.name));
    }
  }

  return columns.map((col) => ({
    name: col.name,
    type: col.type,
    notNull: col.notnull === 1,
    defaultValue: col.dflt_value,
    primaryKey: col.pk > 0,
    unique: uniqueColumns.has(col.name),
  }));
}

export async function deleteRowFromCustomDbTable({ tableName, key, keyValue }) {
  const db = await getDb();
  await db.run(`DELETE FROM ${tableName} WHERE ${key} = ?`, keyValue);

  await sendEventToClients({
    event: 'custom_db_table:delete',
    data: {
      tableName,
      key,
      keyValue,
    },
  });

  return { success: true, message: `Row deleted from ${tableName}` };
}

export async function insertDataIntoCustomDbTable({ tableName, data }) {
  const db = await getDb();
  const columns = Object.keys(data).join(', ');
  const placeholders = Object.keys(data)
    .map(() => '?')
    .join(', ');
  const values = Object.values(data);

  const result = await db.run(
    `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
    ...values,
  );

  await sendEventToClients({
    event: 'custom_db_table:insert',
    data: {
      tableName,
      rowId: result.lastID,
      data,
    },
  });

  return { success: true, message: `Data inserted into table ${tableName}` };
}

export async function updateDataInCustomDbTable({
  tableName,
  key,
  keyValue,
  data,
}) {
  const db = await getDb();
  const columns = Object.keys(data)
    .map((column) => `${column} = ?`)
    .join(', ');
  const values = Object.values(data);

  await db.run(
    `UPDATE ${tableName} SET ${columns} WHERE ${key} = ?`,
    ...values,
    keyValue,
  );

  await sendEventToClients({
    event: 'custom_db_table:update',
    data: {
      tableName,
      key,
      keyValue,
      updatedData: data,
    },
  });

  return { success: true, message: `Data updated in table ${tableName}` };
}
