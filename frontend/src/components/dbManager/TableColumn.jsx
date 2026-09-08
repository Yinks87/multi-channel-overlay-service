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

const TYPES = ['TEXT', 'NUMBER', 'DECIMAL', 'BOOLEAN', 'STRING[]', 'OBJECT[]', 'OBJECT'];
const COMPLEX_TYPES = new Set(['BOOLEAN', 'STRING[]', 'OBJECT[]', 'OBJECT']);

const TableColumn = ({ column, onChange, onDelete, hasPrimaryKey, isOnly }) => {
  const { id, name, type, required, unique, primaryKey, defaultValue } = column;

  const set = (field, value) => onChange(id, field, value);

  const isComplex = COMPLEX_TYPES.has(type);

  const handlePrimaryKey = (checked) => {
    set('primaryKey', checked);
  };

  const handleType = (value) => {
    set('type', value);
    if (COMPLEX_TYPES.has(value)) {
      set('primaryKey', false);
      set('unique', false);
    }
    if (value === 'BOOLEAN') set('required', false);
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '240px 160px auto auto auto 1fr 40px',
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

      {/* Required */}
      <Tooltip title="Required">
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={required}
              disabled={primaryKey || type === 'BOOLEAN'}
              onChange={(e) => set('required', e.target.checked)}
            />
          }
          label={<Typography variant="caption">REQ</Typography>}
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
              disabled={primaryKey || isComplex}
              onChange={(e) => set('unique', e.target.checked)}
            />
          }
          label={<Typography variant="caption">UNI</Typography>}
          sx={{ m: 0 }}
        />
      </Tooltip>

      {/* PRIMARY KEY */}
      {/* flags a field as the UI row identifier — not a MongoDB constraint */}
      <Tooltip title="Row identifier used for updates / deletes">
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={primaryKey}
              disabled={(hasPrimaryKey && !primaryKey) || isComplex}
              onChange={(e) => handlePrimaryKey(e.target.checked)}
            />
          }
          label={<Typography variant="caption">PK</Typography>}
          sx={{ m: 0 }}
        />
      </Tooltip>

      {/* Default Value */}
      {type === 'BOOLEAN' ? (
        <Select
          size="small"
          value={defaultValue}
          onChange={(e) => set('defaultValue', e.target.value)}
          displayEmpty
        >
          <MenuItem value="true">true</MenuItem>
          <MenuItem value="false">false</MenuItem>
        </Select>
      ) : (
        <TextField
          size="small"
          placeholder="Default"
          value={defaultValue}
          disabled={isComplex}
          onChange={(e) => set('defaultValue', e.target.value)}
        />
      )}

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
