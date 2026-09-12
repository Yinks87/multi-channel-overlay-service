import { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FolderIcon from '@mui/icons-material/Folder';
import RouteIcon from '@mui/icons-material/AltRoute';
import ArticleIcon from '@mui/icons-material/Article';
import CopyAllIcon from '@mui/icons-material/CopyAll';
import { createOverlay, updateOverlay } from '../../api/overlayApi';
import { useAlert } from '../../contexts/AlertContext';
import api from '../../api/api';
import FormDialog from '../../components/FormDialog';
import { normalizeParams } from './lib';

const system = import.meta.env.VITE_PLATFORM;

const EMPTY_FORM = {
  name: '',
  routePath: '',
  folderPath: '',
  entryFile: 'index.html',
  notes: '',
  params: {},
  streamerIds: [],
  webOverlay: false,
  overlayType: ['streamer'],
  width: 800,
  height: 600,
};

const OverlayFormDialog = ({
  open,
  onClose,
  initial,
  onSaved,
  streamers = [],
  overlays = [],
}) => {
  function toParamRows(params) {
    const entries = Object.entries(normalizeParams(params));
    return entries.length > 0
      ? entries.map(([key, value]) => ({ key, value: String(value ?? '') }))
      : [makeParam()];
  }

  const makeParam = () => ({
    key: '',
    value: '',
  });

  function toParamsObject(rows) {
    return rows.reduce((acc, row) => {
      const key = row.key.trim();
      if (!key) return acc;
      acc[key] = row.value;
      return acc;
    }, {});
  }

  const { showAlert } = useAlert();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paramRows, setParamRows] = useState([makeParam()]);
  const [cloneSource, setCloneSource] = useState('');
  const [folderPickerLoading, setFolderPickerLoading] = useState(false);

  const handleOpenFolder = async () => {
    setFolderPickerLoading(true);
    try {
      const res = await api.get('/api/v1/overlay/folder-picker');
      if (res.data.path) {
        setForm((p) => ({ ...p, folderPath: res.data.path }));
      }
    } catch (error) {
      // silently fail — user can still type the path manually
    } finally {
      setFolderPickerLoading(false);
    }
  };

  const handleClone = () => {
    const src = overlays.find((o) => o.id === cloneSource);
    if (!src) return;
    const cloned = {
      name: `${src.name} (copy)`,
      routePath: src.route_path,
      folderPath: src.folder_path,
      entryFile: src.entry_file,
      notes: src.notes ?? '',
      params: normalizeParams(src.params),
      streamerIds: src.streamer_ids ?? [],
      webOverlay: src.web_overlay ?? false,
      overlayType: src.overlay_type ?? ['streamer'],
      width: src.width ?? 800,
      height: src.height ?? 600,
    };
    setForm(cloned);
    setParamRows(toParamRows(cloned.params));
    setError('');
  };

  useEffect(() => {
    if (open) {
      const nextForm = initial
        ? {
            name: initial.name,
            routePath: initial.route_path,
            folderPath: initial.folder_path,
            entryFile: initial.entry_file,
            notes: initial.notes ?? '',
            webOverlay: initial.web_overlay ?? false,
            params: normalizeParams(initial.params),
            streamerIds: initial.streamer_ids ?? [],
            webOverlay: initial.web_overlay ?? false,
            overlayType: initial.overlay_type ?? ['streamer'],
            width: initial.width ?? 800,
            height: initial.height ?? 600,
          }
        : EMPTY_FORM;

      setForm(nextForm);
      setParamRows(toParamRows(nextForm.params));
      setCloneSource('');
      setError('');
    }
  }, [open, initial]);

  const set = (field) => (e) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const setNum = (field) => (e) =>
    setForm((p) => ({ ...p, [field]: parseInt(e.target.value, 10) || 0 }));

  const validate = () => {
    if (!form.name.trim()) return 'Name is required.';
    if (!form.routePath.trim()) return 'Endpoint is required.';
    if (!form.routePath.startsWith('/')) return 'Endpoint must start with /.';
    if (/\s/.test(form.routePath)) return 'Endpoint must not contain spaces.';
    if (!form.folderPath.trim()) return 'Folder path is required.';
    if (!form.entryFile.trim()) return 'Entry file is required.';
    if (form.overlayType.length === 0)
      return 'Select at least one visibility option.';
    const duplicateKeys = new Set();
    for (const row of paramRows) {
      const key = row.key.trim();
      if (!key) continue;
      if (duplicateKeys.has(key)) return `Duplicate param key: ${key}`;
      duplicateKeys.add(key);
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setLoading(true);
    setError('');
    const payload = {
      ...form,
      params: toParamsObject(paramRows),
    };
    try {
      if (isEdit) {
        await updateOverlay({ id: initial.id, ...payload });
        showAlert({
          message: `Overlay "${form.name}" updated`,
          severity: 'success',
        });
      } else {
        await createOverlay(payload);
        showAlert({
          message: `Overlay "${form.name}" created`,
          severity: 'success',
        });
      }
      onSaved();
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
      title={isEdit ? 'Edit Overlay' : 'Add Overlay'}
      onConfirm={handleSubmit}
      confirmLabel={isEdit ? 'Save Changes' : 'Add Overlay'}
      loading={loading}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Clone section — only shown when creating a new overlay */}
        {!isEdit && overlays.length > 0 && (
          <>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Select
                size="small"
                displayEmpty
                value={cloneSource}
                onChange={(e) => setCloneSource(e.target.value)}
                sx={{ flex: 1 }}
                renderValue={(v) =>
                  v
                    ? overlays.find((o) => o.id === v)?.name
                    : 'Clone from existing overlay…'
                }
              >
                <MenuItem value="" disabled>
                  Clone from existing overlay…
                </MenuItem>
                {overlays.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name}
                  </MenuItem>
                ))}
              </Select>
              <Button
                variant="outlined"
                size="small"
                disabled={!cloneSource}
                startIcon={<CopyAllIcon />}
                onClick={handleClone}
              >
                Clone
              </Button>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />
          </>
        )}

        <TextField
          label="Name"
          size="small"
          value={form.name}
          onChange={set('name')}
          placeholder="e.g. Cyclist Individual"
        />
        <TextField
          label="Overlay Endpoint"
          size="small"
          value={form.routePath}
          onChange={set('routePath')}
          placeholder="/endpoint-to-overlay"
          helperText="Path the overlay is served on"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <RouteIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            label="Folder Path (server-side)"
            size="small"
            value={form.folderPath}
            onChange={set('folderPath')}
            fullWidth
            placeholder={
              system === 'win'
                ? 'C:/path/to/overlay-folder'
                : '/app/overlays/...'
            }
            helperText={
              system === 'linux'
                ? 'copy the overlay folder to the /app/overlays/ path'
                : null
            }
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <FolderIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          {system === 'win' && (
            <IconButton
              onClick={handleOpenFolder}
              disabled={folderPickerLoading}
              size="small"
              sx={{ ml: 1, mt: 0.5 }}
            >
              {folderPickerLoading ? (
                <CircularProgress size={16} />
              ) : (
                <FolderOpenIcon fontSize="small" />
              )}
            </IconButton>
          )}
        </Box>
        <TextField
          label="Entry File"
          size="small"
          value={form.entryFile}
          onChange={set('entryFile')}
          placeholder="index.html"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <ArticleIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          label="Notes / Instructions"
          multiline
          rows={3}
          value={form.notes}
          onChange={set('notes')}
          placeholder="Add usage instructions or details visible to streamers"
          helperText="Shown on the overlay card — visible to all users"
        />

        {/* Overlay Type */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Visible to
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Which user roles can see this overlay. Select at least one.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {[
              { value: 'streamer', label: 'Streamer' },
              { value: 'moderator', label: 'Moderator' },
              { value: 'admin', label: 'Admin' },
            ].map(({ value, label }) => (
              <Box
                key={value}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <input
                  type="checkbox"
                  id={`ot-${value}`}
                  checked={form?.overlayType?.includes(value)}
                  onChange={(e) => {
                    setForm((p) => ({
                      ...p,
                      overlayType: e.target.checked
                        ? [...p.overlayType, value]
                        : p.overlayType.filter((t) => t !== value),
                    }));
                  }}
                  style={{
                    accentColor: '#309abd',
                    width: 16,
                    height: 16,
                    cursor: 'pointer',
                  }}
                />
                <Typography
                  component="label"
                  htmlFor={`ot-${value}`}
                  variant="body2"
                  sx={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Web Overlay Toggle */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            mb: 2,
          }}
        >
          <Typography variant="body2" fontWeight={700}>
            Web Overlay
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Enable this if the overlay should have no drag&drop button for OBS.
          </Typography>
          <Box
            key="web-overlay"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <input
              type="checkbox"
              id="web-overlay-switch"
              checked={form.webOverlay}
              onChange={(e) => {
                setForm((p) => ({
                  ...p,
                  webOverlay: e.target.checked,
                }));
              }}
              style={{
                accentColor: '#309abd',
                width: 16,
                height: 16,
                cursor: 'pointer',
              }}
            />
            <Typography
              component="label"
              htmlFor="web-overlay-switch"
              variant="body2"
              sx={{ cursor: 'pointer', userSelect: 'none' }}
            >
              Web Overlay
            </Typography>
          </Box>
        </Box>

        {/* Streamer Assignment */}
        <Autocomplete
          multiple
          options={streamers.filter((s) => !form.streamerIds.includes(s.id))}
          getOptionLabel={(o) => o.twitch?.display_name ?? o.userName}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Avatar
                src={option.twitch?.profile_image_url}
                sx={{ width: 24, height: 24, mr: 1 }}
              />
              {option.twitch?.display_name ?? option.userName}
            </li>
          )}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          value={streamers.filter((s) => form.streamerIds.includes(s.id))}
          onChange={(_, selected) =>
            setForm((p) => ({ ...p, streamerIds: selected.map((s) => s.id) }))
          }
          renderValue={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  avatar={<Avatar src={option.twitch?.profile_image_url} />}
                  label={option.twitch?.display_name ?? option.userName}
                  size="small"
                  {...tagProps}
                />
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Assigned Streamers"
              size="small"
              placeholder={form.streamerIds.length === 0 ? 'All streamers' : ''}
              helperText="Leave empty to make this overlay visible to all streamers"
            />
          )}
        />

        {/* URL Params */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            URL Params
          </Typography>
          <Typography variant="caption" color="text.secondary">
            These values are added automatically as URLSearchParams to the
            overlay URL.
          </Typography>
          {paramRows.map((row, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                color="error"
                onClick={() => {
                  setParamRows((prev) =>
                    prev.length > 1
                      ? prev.filter((_, rowIndex) => rowIndex !== index)
                      : [makeParam()],
                  );
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
              <TextField
                label="Param"
                size="small"
                value={row.key}
                onChange={(e) => {
                  const nextRows = [...paramRows];
                  nextRows[index] = { ...nextRows[index], key: e.target.value };
                  setParamRows(nextRows);
                }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Value"
                size="small"
                value={row.value}
                onChange={(e) => {
                  const nextRows = [...paramRows];
                  nextRows[index] = {
                    ...nextRows[index],
                    value: e.target.value,
                  };
                  setParamRows(nextRows);
                }}
                sx={{ flex: 1 }}
              />
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              size="small"
              sx={{ alignSelf: 'flex-end' }}
              startIcon={<AddIcon />}
              onClick={() => setParamRows((prev) => [...prev, makeParam()])}
            >
              Add Param
            </Button>
          </Box>
        </Box>

        {/* Dimensions */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Width (px)"
            type="number"
            size="small"
            value={form.width}
            onChange={setNum('width')}
            slotProps={{ input: { min: 1 } }}
            sx={{ flex: 1 }}
            helperText="OBS Browser Source width"
          />
          <TextField
            label="Height (px)"
            type="number"
            size="small"
            value={form.height}
            onChange={setNum('height')}
            slotProps={{ input: { min: 1 } }}
            sx={{ flex: 1 }}
            helperText="OBS Browser Source height"
          />
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
      </Box>
    </FormDialog>
  );
};

export default OverlayFormDialog;
