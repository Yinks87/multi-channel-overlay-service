import {
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import DeleteIcon from '@mui/icons-material/Delete';
import React from 'react';

const TYPES = ['TEXT', 'INTEGER', 'REAL', 'BLOB'];

const TableColumn = ({ column, onChange, onDelete, hasPrimaryKey, isOnly }) => {
  const {
    id,
    name,
    type,
    notNull,
    unique,
    primaryKey,
    autoIncrement,
    defaultValue,
  } = column;

  const set = (field, value) => onChange(id, field, value);

  const handlePrimaryKey = (checked) => {
    set('primaryKey', checked);
    if (!checked) set('autoIncrement', false);
  };

  const handleType = (value) => {
    set('type', value);
    if (value !== 'INTEGER') set('autoIncrement', false);
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 120px auto auto auto auto 120px 40px',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: 1,
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Name */}
      <TextField
        size="small"
        placeholder="Field name"
        value={name}
        onChange={(e) => set('name', e.target.value)}
        error={!name.trim()}
      />

      {/* Type */}
      <Select
        size="small"
        value={type}
        onChange={(e) => handleType(e.target.value)}
      >
        {TYPES.map((t) => (
          <MenuItem key={t} value={t}>
            {t}
          </MenuItem>
        ))}
      </Select>

      {/* NOT NULL */}
      <Tooltip title="NOT NULL">
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={notNull}
              disabled={primaryKey}
              onChange={(e) => set('notNull', e.target.checked)}
            />
          }
          label={<Typography variant="caption">NN</Typography>}
          sx={{ m: 0 }}
        />
      </Tooltip>

      {/* UNIQUE */}
      <Tooltip title="UNIQUE">
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={unique}
              disabled={primaryKey}
              onChange={(e) => set('unique', e.target.checked)}
            />
          }
          label={<Typography variant="caption">UNI</Typography>}
          sx={{ m: 0 }}
        />
      </Tooltip>

      {/* PRIMARY KEY */}
      <Tooltip title="PRIMARY KEY">
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={primaryKey}
              disabled={hasPrimaryKey && !primaryKey}
              onChange={(e) => handlePrimaryKey(e.target.checked)}
            />
          }
          label={<Typography variant="caption">PK</Typography>}
          sx={{ m: 0 }}
        />
      </Tooltip>

      {/* AUTOINCREMENT */}
      <Tooltip title="AUTOINCREMENT (INTEGER PRIMARY KEY only)">
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={autoIncrement}
              disabled={!(type === 'INTEGER' && primaryKey)}
              onChange={(e) => set('autoIncrement', e.target.checked)}
            />
          }
          label={<Typography variant="caption">AI</Typography>}
          sx={{ m: 0 }}
        />
      </Tooltip>

      {/* Default Value */}
      <TextField
        size="small"
        placeholder="Default"
        value={defaultValue}
        onChange={(e) => set('defaultValue', e.target.value)}
      />

      {/* Delete */}
      <IconButton
        size="small"
        color="error"
        disabled={isOnly}
        onClick={() => onDelete(id)}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default TableColumn;
