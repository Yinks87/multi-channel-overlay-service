import { useState } from 'react';
import {
  Box,
  Button,
  Divider,
  TextField,
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
  required: false,
  unique: false,
  primaryKey: false,
  defaultValue: '',
});

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

    const cols = columns.map(({ name, type, required, unique, primaryKey, defaultValue }) => ({
      name: name.trim(),
      type,
      required,
      unique,
      primaryKey,
      defaultValue: defaultValue.trim() || null,
    }));

    setLoading(true);
    setError('');
    try {
      await createTable({ tableName: tableName.trim(), columns: cols });
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
