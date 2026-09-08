import mongoose from 'mongoose';
import CustomTableSchemaModel from '../schemas/custom-table-schemas.js';
import { sendEventToClients } from '../../router/api-v1/overlay/client-v1.js';

// _schemas is never shown in the tables list
const HIDDEN_COLLECTIONS = new Set(['_schemas']);

// System collections that cannot be dropped via the custom-tables API
const PROTECTED_COLLECTIONS = new Set([
  'overlays', 'users', 'app_settings', 'user_emotes',
  'global_emotes', 'registered_streamers',
]);

function getCollection(tableName) {
  return mongoose.connection.collection(tableName);
}

function docToRow(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { __rowid__: _id.toString(), ...rest };
}

function buildQuery(key, keyValue) {
  if (key === '__rowid__') {
    return { _id: new mongoose.Types.ObjectId(keyValue) };
  }
  return { [key]: keyValue };
}

export async function createCustomDbTable({ tableName, columns }) {
  await mongoose.connection.createCollection(tableName);
  await CustomTableSchemaModel.create({ name: tableName, columns });
  return tableName;
}

export async function getCustomDbTables() {
  const cols = await mongoose.connection.db.listCollections().toArray();
  return cols.map((c) => c.name).filter((n) => !HIDDEN_COLLECTIONS.has(n));
}

// Get all collections — protected (dashboard use only for owner)
export async function getAllTables() {
  const cols = await mongoose.connection.db.listCollections().toArray();
  return cols.map((c) => c.name);
}

export async function deleteCustomDbTable({ tableName }) {
  if (PROTECTED_COLLECTIONS.has(tableName)) {
    throw Object.assign(
      new Error(`Cannot delete system collection: ${tableName}`),
      { status: 403 },
    );
  }
  await mongoose.connection.dropCollection(tableName);
  await CustomTableSchemaModel.deleteOne({ name: tableName });
  return { success: true, message: `Table ${tableName} deleted successfully` };
}

export async function getDataFromCustomDbTable({ tableName }) {
  const docs = await getCollection(tableName).find({}).toArray();
  return docs.map(docToRow);
}

export async function getRowFromCustomDbTable({ tableName, key, keyValue }) {
  const doc = await getCollection(tableName).findOne(buildQuery(key, keyValue));
  return docToRow(doc);
}

export async function getTableSchema(tableName) {
  const schema = await CustomTableSchemaModel.findOne({ name: tableName });
  return schema?.columns ?? [];
}

export async function deleteRowFromCustomDbTable({ tableName, key, keyValue }) {
  await getCollection(tableName).deleteOne(buildQuery(key, keyValue));

  await sendEventToClients({
    event: 'custom_db_table:delete',
    data: { tableName, key, keyValue },
  });

  return { success: true, message: `Row deleted from ${tableName}` };
}

export async function insertDataIntoCustomDbTable({ tableName, data }) {
  const result = await getCollection(tableName).insertOne(data);

  await sendEventToClients({
    event: 'custom_db_table:insert',
    data: { tableName, rowId: result.insertedId.toString(), data },
  });

  return { success: true, message: `Data inserted into table ${tableName}` };
}

export async function updateDataInCustomDbTable({ tableName, key, keyValue, data }) {
  await getCollection(tableName).updateOne(buildQuery(key, keyValue), { $set: data });

  await sendEventToClients({
    event: 'custom_db_table:update',
    data: { tableName, key, keyValue, updatedData: data },
  });

  return { success: true, message: `Data updated in table ${tableName}` };
}
