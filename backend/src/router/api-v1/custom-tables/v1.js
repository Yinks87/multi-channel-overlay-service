import express from 'express';
import {
  getCustomDbTables,
  getDataFromCustomDbTable,
  createCustomDbTable,
  deleteCustomDbTable,
  insertDataIntoCustomDbTable,
  updateDataInCustomDbTable,
  getTableSchema,
  deleteRowFromCustomDbTable,
  getRowFromCustomDbTable,
} from '../../../db/services/customDbTableService.js';
import { requireRole } from '../../../middleware/auth.js';

const customTablesRouter = express.Router();

// List all tables — protected (dashboard use only)
customTablesRouter.get(
  '/',
  requireRole('owner', 'db:manage'),
  async (req, res, next) => {
    try {
      const tables = await getCustomDbTables();
      res.json({ data: tables });
    } catch (err) {
      next(err);
    }
  },
);

// Create table — protected
customTablesRouter.post(
  '/create',
  requireRole('owner', 'db:manage'),
  async (req, res, next) => {
    const { tableName, schema } = req.body;

    if (!tableName || !schema || typeof schema !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid tableName or schema',
      });
    }

    const existingTables = await getCustomDbTables();
    if (existingTables.includes(tableName)) {
      return res.status(400).json({
        success: false,
        error: `Table ${tableName} already exists`,
      });
    }

    const columns = Object.keys(schema)
      .map((key) => `${key} ${schema[key]}`)
      .join(', ');
    try {
      const createdTableName = await createCustomDbTable({
        tableName,
        schema: columns,
      });
      res.status(201).json({
        message: `Custom table ${createdTableName} created successfully`,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Delete table — protected
customTablesRouter.post(
  '/delete/:tableName',
  requireRole('owner', 'db:manage'),
  async (req, res, next) => {
    const { tableName } = req.params;

    if (!tableName) {
      return res.status(400).json({
        success: false,
        error: 'Missing tableName',
      });
    }

    const existingTables = await getCustomDbTables();
    if (!existingTables.includes(tableName)) {
      return res.status(404).json({
        success: false,
        error: `Table ${tableName} does not exist`,
      });
    }

    try {
      await deleteCustomDbTable({ tableName });
      res
        .status(200)
        .json({ message: `Custom table ${tableName} deleted successfully` });
    } catch (err) {
      next(err);
    }
  },
);

customTablesRouter.get('/:tableName/schema', async (req, res, next) => {
  const { tableName } = req.params;
  try {
    const schema = await getTableSchema(tableName);
    res.json({ data: schema });
  } catch (err) {
    next(err);
  }
});

customTablesRouter.get('/:tableName', async (req, res, next) => {
  const { tableName, key, keyValue } = req.params;

  try {
    const data = await getDataFromCustomDbTable({ tableName });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

customTablesRouter.get('/row/:tableName', async (req, res, next) => {
  const { tableName } = req.params;
  const { key, keyValue } = req.query;

  if (!key || keyValue === undefined) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing key or keyValue' });
  }

  try {
    const row = await getRowFromCustomDbTable({ tableName, key, keyValue });
    if (!row) {
      return res.status(404).json({
        success: false,
        error: `Row with ${key}=${keyValue} not found in table ${tableName}`,
      });
    }
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

customTablesRouter.post('/:tableName', async (req, res, next) => {
  const { tableName } = req.params;
  const data = req.body;

  if (!tableName) {
    return res.status(400).json({
      success: false,
      error: 'Missing tableName',
    });
  }

  if (!data || typeof data !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid data',
    });
  }

  try {
    await insertDataIntoCustomDbTable({ tableName, data });
    res
      .status(200)
      .json({ message: `Inserted data into custom table: ${tableName}` });
  } catch (err) {
    next(err);
  }
});

customTablesRouter.patch('/:tableName', async (req, res, next) => {
  const { tableName } = req.params;
  const { key, keyValue, data } = req.body;

  if (!tableName || !key || !data || typeof data !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid tableName, key, or data',
    });
  }

  try {
    await updateDataInCustomDbTable({ tableName, key, keyValue, data });
    res
      .status(200)
      .json({ message: `Updated data in custom table: ${tableName}` });
  } catch (err) {
    next(err);
  }
});

customTablesRouter.delete('/:tableName', async (req, res, next) => {
  const { tableName } = req.params;
  const { key, keyValue } = req.body;

  if (!key || keyValue === undefined) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing key or keyValue' });
  }

  try {
    await deleteRowFromCustomDbTable({ tableName, key, keyValue });
    res.status(200).json({ message: `Row deleted from ${tableName}` });
  } catch (err) {
    next(err);
  }
});

export default customTablesRouter;
