import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { v4 as uuidv4 } from 'uuid';
import TableColumn from './TableColumn';
import { createTable } from '../../api/customTablesApi';
import { useAlert } from '../../contexts/AlertContext';
import FormDialog from '../FormDialog';

const makeColumn = () => ({
  id: uuidv4(),
  name: '',
  type: 'TEXT',
  notNull: false,
  unique: false,
  primaryKey: false,
  autoIncrement: false,
  defaultValue: '',
});

function buildColumnDef(col) {
  const parts = [col.type];
  if (col.primaryKey) parts.push('PRIMARY KEY');
  if (col.autoIncrement && col.type === 'INTEGER' && col.primaryKey)
    parts.push('AUTOINCREMENT');
  if (col.notNull && !col.primaryKey) parts.push('NOT NULL');
  if (col.unique && !col.primaryKey) parts.push('UNIQUE');
  if (col.defaultValue.trim()) parts.push(`DEFAULT ${col.defaultValue.trim()}`);
  return parts.join(' ');
}

const CreateTableDialog = ({ open, onClose, onCreated }) => {
  const { showAlert } = useAlert();
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState([makeColumn()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasPrimaryKey = columns.some((c) => c.primaryKey);

  const handleChange = (id, field, value) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const handleDelete = (id) => {
    setColumns((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddColumn = () => {
    setColumns((prev) => [...prev, makeColumn()]);
  };

  const validate = () => {
    if (!tableName.replace(/\s/g, '')) return 'Table name is required.';
    if (tableName.includes(' ')) return 'Table name cannot contain spaces.';
    if (columns.length === 0) return 'At least one column is required.';
    const names = columns.map((c) => c.name.replace(/\s/g, ''));
    if (names.some((n) => !n)) return 'All column names must be filled in.';
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length) return `Duplicate column name: "${duplicates[0]}"`;
    return null;
  };

  const handleCreate = async () => {
    const validationError = validate();
    if (validationError) {
      showAlert({ message: validationError, severity: 'error' });
      setError(validationError);
      return;
    }

    const schema = Object.fromEntries(
      columns.map((col) => [col.name.trim(), buildColumnDef(col)]),
    );

    setLoading(true);
    setError('');
    try {
      await createTable({ tableName: tableName.trim(), schema });
      showAlert({
        message: `Table "${tableName}" created successfully`,
        severity: 'success',
      });
      onCreated();
      handleClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTableName('');
    setColumns([makeColumn()]);
    setError('');
    onClose();
  };

  return (
    <>
      <FormDialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        title="Create New Table"
        loading={loading}
        onSubmit={handleCreate}
        actions={
          <>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              variant="contained"
              loading={loading}
            >
              Create Table
            </Button>
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Table Name"
            size="small"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="e.g. event_data"
            sx={{ maxWidth: 320 }}
          />

          <Divider />

          {/* Column header labels */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px auto auto auto auto 120px 40px',
              gap: 1,
              px: 1,
            }}
          >
            {['Name', 'Type', 'NN', 'UNI', 'PK', 'AI', 'Default', ''].map(
              (label) => (
                <Typography
                  key={label}
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                >
                  {label}
                </Typography>
              ),
            )}
          </Box>

          {/* Column rows */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {columns.map((col) => (
              <TableColumn
                key={col.id}
                column={col}
                onChange={handleChange}
                onDelete={handleDelete}
                hasPrimaryKey={hasPrimaryKey}
                isOnly={columns.length === 1}
              />
            ))}
          </Box>

          <Button
            startIcon={<AddIcon />}
            onClick={handleAddColumn}
            variant="outlined"
            size="small"
            sx={{ alignSelf: 'flex-end' }}
          >
            Add Column
          </Button>
        </Box>
      </FormDialog>
    </>
  );
};

export default CreateTableDialog;
