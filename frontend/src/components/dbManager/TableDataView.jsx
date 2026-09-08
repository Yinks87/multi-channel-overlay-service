import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  fetchTableData,
  fetchTableSchema,
  insertRow,
  updateRow,
  deleteRow,
} from '../../api/customTablesApi';
import { useAlert } from '../../contexts/AlertContext';
import FormDialog from '../FormDialog';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns { key, keyValue } for a row. PK column preferred; rowid fallback. */
function getRowKey(row, schema) {
  const pkCol = schema.find((c) => c.primaryKey);
  if (pkCol) return { key: pkCol.name, keyValue: row[pkCol.name] };
  return { key: 'rowid', keyValue: row.__rowid__ };
}

const BADGE_COLORS = {
  PK: 'warning',
  REQ: 'error',
  UNI: 'info',
  DEF: 'default',
};

function SchemaBadges({ col }) {
  const badges = [];
  if (col.primaryKey) badges.push('PK');
  if (col.required && !col.primaryKey) badges.push('REQ');
  if (col.unique && !col.primaryKey) badges.push('UNI');
  if (col.defaultValue !== null) badges.push('DEF');
  if (!badges.length) return null;
  return (
    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mt: 0.5 }}>
      {badges.map((b) => (
        <Chip
          key={b}
          label={b}
          size="small"
          color={BADGE_COLORS[b]}
          sx={{ height: 16, fontSize: '0.6rem' }}
        />
      ))}
    </Stack>
  );
}

// ── Type helpers ─────────────────────────────────────────────────────────────

function getInitialValue(col, initialValues) {
  const existing = initialValues?.[col.name];
  if (col.type === 'BOOLEAN') {
    if (existing !== undefined) return Boolean(existing);
    if (col.defaultValue === 'true') return true;
    if (col.defaultValue === 'false') return false;
    return false;
  }
  if (col.type === 'STRING[]')
    return Array.isArray(existing) ? existing.join('\n') : '';
  if (col.type === 'OBJECT[]' || col.type === 'OBJECT')
    return existing != null
      ? JSON.stringify(existing, null, 2)
      : col.type === 'OBJECT'
        ? '{}'
        : '[]';
  return existing ?? '';
}

function renderFieldInput(col, value, onChange, disabled) {
  if (col.type === 'BOOLEAN') {
    return (
      <FormControlLabel
        key={col.name}
        label={<Typography variant="body2">{col.name}</Typography>}
        control={
          <Switch
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
        }
        sx={{ ml: 0 }}
      />
    );
  }
  if (col.type === 'STRING[]') {
    return (
      <TextField
        key={col.name}
        label={`${col.name} — one item per line`}
        size="small"
        multiline
        minRows={2}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (col.type === 'OBJECT[]' || col.type === 'OBJECT') {
    return (
      <TextField
        key={col.name}
        label={`${col.name} (JSON)`}
        size="small"
        multiline
        minRows={3}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (col.type === 'DECIMAL') {
    return (
      <TextField
        key={col.name}
        label={`${col.name} (${col.type})${col.primaryKey ? ' · PK' : ''}`}
        size="small"
        type="number"
        value={value ?? ''}
        disabled={disabled}
        inputProps={{ step: 'any' }}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <TextField
      key={col.name}
      label={`${col.name} (${col.type})${col.primaryKey ? ' · PK' : ''}`}
      size="small"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function renderCellValue(col, value) {
  if (value === null || value === undefined) {
    return (
      <Typography variant="caption" color="text.disabled">
        NULL
      </Typography>
    );
  }
  if (col.type === 'BOOLEAN') {
    return (
      <Chip
        label={value ? 'true' : 'false'}
        size="small"
        color={value ? 'success' : 'default'}
        sx={{ height: 18, fontSize: '0.65rem' }}
      />
    );
  }
  if (col.type === 'STRING[]' && Array.isArray(value)) {
    if (!value.length) return '[]';
    const preview = value.slice(0, 3).join(', ');
    return value.length > 3 ? `${preview} +${value.length - 3}` : preview;
  }
  if (col.type === 'OBJECT[]' || col.type === 'OBJECT') {
    const s = JSON.stringify(value);
    return (
      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
        {s.length > 50 ? `${s.slice(0, 50)}…` : s}
      </Typography>
    );
  }
  return String(value);
}

// ── Insert / Edit Row Dialog ──────────────────────────────────────────────────
const RowFormDialog = ({
  open,
  onClose,
  tableName,
  schema,
  initialValues,
  onDone,
  mode,
}) => {
  const { showAlert } = useAlert();
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const visibleCols = schema.filter((c) => c.name !== '__rowid__');

  useEffect(() => {
    if (open) {
      setValues(
        Object.fromEntries(
          visibleCols.map((c) => [c.name, getInitialValue(c, initialValues)]),
        ),
      );
      setError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    const payload = {};
    for (const col of visibleCols) {
      const val = values[col.name];
      if (col.type === 'BOOLEAN') {
        payload[col.name] = Boolean(val);
      } else if (col.type === 'STRING[]') {
        const items = String(val)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (items.length) payload[col.name] = items;
      } else if (col.type === 'OBJECT[]' || col.type === 'OBJECT') {
        const str = String(val).trim();
        if (str && str !== '[]' && str !== '{}') {
          try {
            payload[col.name] = JSON.parse(str);
          } catch {
            setError(`Invalid JSON for field "${col.name}"`);
            return;
          }
        }
      } else if (col.type === 'DECIMAL') {
        const num = parseFloat(val);
        if (val !== '' && !isNaN(num)) payload[col.name] = num;
      } else if (val !== '') {
        payload[col.name] = val;
      }
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'insert') {
        await insertRow(tableName, payload);
        showAlert({
          message: 'Row inserted successfully',
          severity: 'success',
        });
      } else {
        const { key, keyValue } = getRowKey(initialValues, schema);
        await updateRow(tableName, key, keyValue, payload);
        showAlert({ message: 'Row updated successfully', severity: 'success' });
      }
      onDone();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <FormDialog
        open={open}
        onClose={onClose}
        title={
          <>
            {mode === 'insert' ? 'Insert Row into' : 'Edit Row in'}{' '}
            <em>{tableName}</em>
          </>
        }
        actions={
          <>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={loading}
            >
              {mode === 'insert' ? 'Insert' : 'Save'}
            </Button>
          </>
        }
        loading={loading}
        onSubmit={handleSubmit}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {visibleCols.map((col) =>
            renderFieldInput(
              col,
              values[col.name],
              (v) => setValues((prev) => ({ ...prev, [col.name]: v })),
              mode === 'edit' && col.primaryKey,
            ),
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </FormDialog>
    </>
  );
};

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────

const DeleteRowDialog = ({
  open,
  onClose,
  tableName,
  row,
  schema,
  onDeleted,
}) => {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      const { key, keyValue } = getRowKey(row, schema);
      await deleteRow(tableName, key, keyValue);
      showAlert({ message: 'Row deleted', severity: 'success' });
      onDeleted();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Delete Row"
      loading={loading}
      actions={
        <>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={loading}
          >
            Delete
          </Button>
        </>
      }
    >
      <Typography>
        Are you sure you want to delete this row? This cannot be undone.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </FormDialog>
  );
};

// ── Table Data View ───────────────────────────────────────────────────────────

const TableDataView = ({ tableName }) => {
  const [rows, setRows] = useState([]);
  const [schema, setSchema] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [insertOpen, setInsertOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, schemaData] = await Promise.all([
        fetchTableData(tableName),
        fetchTableSchema(tableName),
      ]);
      setRows(data ?? []);
      setSchema(schemaData ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleCols = schema.filter((c) => c.name !== '__rowid__');

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {tableName}
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setInsertOpen(true)}
          disabled={loading}
        >
          Insert Row
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!loading && error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && rows.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexGrow: 1,
            gap: 1,
            color: 'text.disabled',
          }}
        >
          <Typography variant="body2">No data in this table yet.</Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setInsertOpen(true)}
          >
            Insert first row
          </Button>
        </Box>
      )}

      {!loading && !error && rows.length > 0 && (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ flexGrow: 1 }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 80 }} />
                {visibleCols.map((col) => (
                  <TableCell key={col.name} sx={{ verticalAlign: 'top' }}>
                    <Typography variant="body2" fontWeight={700}>
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: '0.65rem' }}
                      >
                        Name:{' '}
                      </Typography>
                      {col.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      <Typography
                        component="span"
                        variant="body2"
                        fontWeight={700}
                        sx={{ fontSize: '0.65rem' }}
                      >
                        Type:{' '}
                      </Typography>
                      {col.type}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mt: 0.5,
                      }}
                    >
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: '0.65rem' }}
                      >
                        Opts:{' '}
                      </Typography>
                      <SchemaBadges col={col} />
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditRow(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  {visibleCols.map((col) => (
                    <TableCell key={col.name}>
                      {renderCellValue(col, row[col.name])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <RowFormDialog
        open={insertOpen}
        onClose={() => setInsertOpen(false)}
        tableName={tableName}
        schema={schema}
        mode="insert"
        onDone={load}
      />
      <RowFormDialog
        open={Boolean(editRow)}
        onClose={() => setEditRow(null)}
        tableName={tableName}
        schema={schema}
        initialValues={editRow}
        mode="edit"
        onDone={load}
      />
      <DeleteRowDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        tableName={tableName}
        row={deleteTarget ?? {}}
        schema={schema}
        onDeleted={load}
      />
    </Box>
  );
};

export default TableDataView;
