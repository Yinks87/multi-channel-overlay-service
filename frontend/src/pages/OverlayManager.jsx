import React, { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import process from 'process';
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
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LayersIcon from '@mui/icons-material/Layers';
import FolderIcon from '@mui/icons-material/Folder';
import RouteIcon from '@mui/icons-material/AltRoute';
import ArticleIcon from '@mui/icons-material/Article';
import PeopleIcon from '@mui/icons-material/People';
import CopyAllIcon from '@mui/icons-material/CopyAll';
import {
  fetchOverlays,
  createOverlay,
  updateOverlay,
  deleteOverlay,
} from '../api/overlayApi';
import { useAlert } from '../contexts/AlertContext';
import api from '../api/api';
import FormDialog from '../components/FormDialog';
import { fetchRegisteredStreamers } from '../api/registeredStreamerApi';

const system = import.meta.env.VITE_PLATFORM;

const BACKEND_ORIGIN = api.defaults.baseURL;
const SERVICE_URL =
  import.meta.env.VITE_BASE_OVERLAY_SERVICE_URL ?? '/overlay-service';

function normalizeParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(
      ([key]) => typeof key === 'string' && key.trim(),
    ),
  );
}

function buildOverlayUrl(overlay, extraParams = {}) {
  const url = new URL(
    `${SERVICE_URL}${overlay.route_path}/${overlay.entry_file}`,
    `${BACKEND_ORIGIN}/`,
  );

  Object.entries(normalizeParams(overlay.params)).forEach(([key, value]) => {
    url.searchParams.set(key, String(value ?? ''));
  });

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

function overlayUrl(overlay) {
  return buildOverlayUrl(overlay);
}

function createDragUrl(overlay) {
  return buildOverlayUrl(overlay, {
    'layer-name': overlay.name,
    'layer-width': overlay.width,
    'layer-height': overlay.height,
  });
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser'));
  } catch {
    return null;
  }
}

const EMPTY_FORM = {
  name: '',
  routePath: '',
  folderPath: '',
  entryFile: 'index.html',
  notes: '',
  params: {},
  streamerIds: [],
  overlayType: ['streamer'],
  width: 800,
  height: 600,
};

const makeParam = () => ({
  key: '',
  value: '',
});

function toParamRows(params) {
  const entries = Object.entries(normalizeParams(params));
  return entries.length > 0
    ? entries.map(([key, value]) => ({ key, value: String(value ?? '') }))
    : [makeParam()];
}

function toParamsObject(rows) {
  return rows.reduce((acc, row) => {
    const key = row.key.trim();
    if (!key) return acc;
    acc[key] = row.value;
    return acc;
  }, {});
}

/* ── OverlayActions — shared by both card types ──────────────────────────── */

const OverlayActions = ({ url, dragUrl, active }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    } else {
      // Fallback for non-secure contexts (HTTP, iframes)
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', dragUrl);
    e.dataTransfer.setData('text/uri-list', dragUrl);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <ActionRow>
      <Tooltip title="Open in browser">
        <IconButton
          size="small"
          component="a"
          href={url}
          target="_blank"
          rel="noreferrer"
          disabled={!active}
          sx={{
            color: 'rgba(255,255,255,0.4)',
            '&:hover': { color: '#fff' },
          }}
        >
          <OpenInNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Button
        size="small"
        variant="outlined"
        startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
        onClick={handleCopy}
        color={copied ? 'success' : 'inherit'}
        sx={{ flex: 1, fontSize: 11, minWidth: 0 }}
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </Button>

      <Tooltip title="Drag into OBS as a Browser Source" placement="top">
        <DragWrapper draggable onDragStart={handleDragStart}>
          <DragIndicatorIcon sx={{ fontSize: 14 }} />
          Drag to OBS
        </DragWrapper>
      </Tooltip>
    </ActionRow>
  );
};

/* ── AdminOverlayCard ────────────────────────────────────────────────────── */

const AdminOverlayCard = ({
  overlay,
  onEdit,
  onDelete,
  onToggle,
  streamers = [],
}) => {
  const { showAlert } = useAlert();
  const url = overlayUrl(overlay);
  const theme = useTheme();

  const handleToggle = async () => {
    try {
      await updateOverlay({ id: overlay.id, active: overlay.active ? 0 : 1 });
      onToggle();
    } catch (e) {
      showAlert({ message: e.message, severity: 'error' });
    }
  };

  return (
    <Card>
      <CardBody>
        {/* Name + controls row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1,
            gap: 1,
            mb: 0.5,
            width: '100%',
          }}
        >
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}
          >
            <ActiveDot active={overlay.active} />
            <Typography
              variant="body2"
              fontWeight={700}
              noWrap
              title={overlay.name}
            >
              {overlay.name}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              gap: 0.25,
            }}
          >
            <Tooltip title={overlay.active ? 'Deactivate' : 'Activate'}>
              <Switch
                size="small"
                checked={Boolean(overlay.active)}
                onChange={handleToggle}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#4caf50' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    bgcolor: '#4caf50',
                  },
                }}
              />
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => onEdit(overlay)}
                sx={{
                  color: 'rgba(255,255,255,0.35)',
                  '&:hover': { color: '#fff' },
                }}
              >
                <EditIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => onDelete(overlay)}
                sx={{
                  color: 'rgba(255,255,255,0.25)',
                  '&:hover': {
                    color: '#ff6b6b',
                    bgcolor: 'rgba(255,80,80,0.1)',
                  },
                }}
              >
                <DeleteIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            flex: 1,
          }}
        >
          {overlay.notes && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                lineHeight: 1.55,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                mb: 0.5,
              }}
            >
              {overlay.notes}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            flex: 1,
          }}
        >
          <RouteTag>{overlay.route_path}</RouteTag>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            flex: 1,
          }}
        >
          {overlay.overlay_type?.length > 0 && (
            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {overlay.overlay_type.map((type) => {
                const colorMap = {
                  streamer: theme.palette.streamer.main,
                  moderator: theme.palette.moderator.main,
                  admin: theme.palette.admin.main,
                };
                return (
                  <Chip
                    key={type}
                    label={type}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      bgcolor: `${colorMap[type] ?? '#555'}22`,
                      color: colorMap[type] ?? '#aaa',
                      border: `1px solid ${colorMap[type] ?? '#555'}55`,
                      textTransform: 'capitalize',
                    }}
                  />
                );
              })}
            </Box>
          )}
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            flex: 1,
          }}
        >
          {overlay.streamer_ids?.length > 0 && (
            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {overlay.streamer_ids.map((id) => {
                const streamer = streamers.find((s) => s.id === id);
                return (
                  <Chip
                    key={id}
                    avatar={
                      <Avatar
                        sx={{
                          '& .MuiAvatar-img': {
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                          },
                        }}
                        src={streamer?.twitch?.profile_image_url}
                      />
                    }
                    label={
                      streamer?.twitch?.display_name
                        ? streamer?.twitch?.display_name
                        : (streamer?.userName ?? 'Unknown')
                    }
                    size="small"
                    sx={{ height: 18, fontSize: '0.6rem' }}
                  />
                );
              })}
            </Box>
          )}
        </Box>

        <OverlayActions
          url={url}
          dragUrl={createDragUrl(overlay)}
          active={overlay.active}
        />
      </CardBody>
    </Card>
  );
};

/* ── StreamerOverlayCard ─────────────────────────────────────────────────── */

const StreamerOverlayCard = ({ overlay, streamers = [] }) => {
  const url = overlayUrl(overlay);
  const theme = useTheme();

  return (
    <Card>
      <CardBody>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            gap: 1,
            mb: 0.5,
            width: '100%',
          }}
        >
          <ActiveDot active={overlay.active} />
          <Typography
            variant="body2"
            fontWeight={700}
            noWrap
            title={overlay.name}
          >
            {overlay.name}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            gap: 0.25,
            flex: 1,
          }}
        >
          {overlay.notes && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                lineHeight: 1.55,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                mb: 0.5,
              }}
            >
              {overlay.notes}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexShrink: 0,
            gap: 0.25,
            flex: 1,
          }}
        >
          {overlay.overlay_type?.length > 0 && (
            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {overlay.overlay_type.map((type) => {
                const colorMap = {
                  streamer: theme.palette.streamer.main,
                  moderator: theme.palette.moderator.main,
                  admin: theme.palette.admin.main,
                };
                return (
                  <Chip
                    key={type}
                    label={type}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      bgcolor: `${colorMap[type] ?? '#555'}22`,
                      color: `${colorMap[type] ?? '#555'}`,
                      border: `1px solid ${colorMap[type] ?? '#555'}55`,
                      textTransform: 'capitalize',
                    }}
                  />
                );
              })}
            </Box>
          )}
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            gap: 0.25,
            flex: 1,
          }}
        >
          {overlay.streamer_ids?.length > 0 && (
            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {overlay.streamer_ids.map((id) => {
                const streamer = streamers.find((s) => s.id === id);
                return (
                  <Chip
                    key={id}
                    avatar={
                      <Avatar
                        sx={{
                          '& .MuiAvatar-img': {
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                          },
                        }}
                        src={streamer?.twitch?.profile_image_url}
                      />
                    }
                    label={
                      streamer?.twitch?.display_name
                        ? streamer?.twitch?.display_name
                        : (streamer?.userName ?? 'Unknown')
                    }
                    size="small"
                    sx={{ height: 18, fontSize: '0.6rem' }}
                  />
                );
              })}
            </Box>
          )}
        </Box>

        <OverlayActions
          url={url}
          dragUrl={createDragUrl(overlay)}
          active={overlay.active}
        />
      </CardBody>
    </Card>
  );
};

const OverlayFormDialog = ({
  open,
  onClose,
  initial,
  onSaved,
  streamers = [],
  overlays = [],
}) => {
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
      routePath: '',
      folderPath: src.folder_path,
      entryFile: src.entry_file,
      notes: src.notes ?? '',
      params: normalizeParams(src.params),
      streamerIds: src.streamer_ids ?? [],
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
            params: normalizeParams(initial.params),
            streamerIds: initial.streamer_ids ?? [],
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
                : './overlays/overlay-folder'
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
                  checked={form.overlayType.includes(value)}
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

        {/* Streamer Assignment */}
        <Autocomplete
          multiple
          options={streamers.filter((s) => !form.streamerIds.includes(s.id))}
          getOptionLabel={(o) => o.twitch?.display_name ?? o.userName}
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

const DeleteDialog = ({ open, onClose, overlay, onDeleted }) => {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await deleteOverlay(overlay.id);
      showAlert({
        message: `Overlay "${overlay.name}" deleted`,
        severity: 'success',
      });
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
      title="Delete Overlay"
      onConfirm={handleDelete}
      confirmLabel="Delete"
      confirmColor="error"
      loading={loading}
      maxWidth="xs"
    >
      <Typography>
        Delete <strong>{overlay?.name}</strong>? The route{' '}
        <code>{overlay?.route_path}</code> will stop serving.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </FormDialog>
  );
};

const OverlayManager = () => {
  const currentUser = getCurrentUser();
  const userRoles = currentUser?.roles ?? [];
  const canEdit =
    userRoles.includes('owner') || userRoles.includes('overlay:manage');

  const [overlays, setOverlays] = useState([]);
  const [streamers, setStreamers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchOverlays();
      setOverlays(data ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchRegisteredStreamers()
      .then((data) => setStreamers(data ?? []))
      .catch(() => {});
  }, []);

  const handleEdit = (overlay) => {
    setEditTarget(overlay);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditTarget(null);
  };

  const activeOverlays = overlays.filter((o) => o.active);
  const displayedOverlays = overlays;

  return (
    <Page>
      {/* Header */}
      <PageHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LayersIcon sx={{ color: '#309abd', fontSize: 26 }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Overlay Manager
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {canEdit
                ? `${overlays.length} overlay${overlays.length !== 1 ? 's' : ''} — ${activeOverlays.length} active`
                : `${activeOverlays.length} overlay${activeOverlays.length !== 1 ? 's' : ''} available`}
            </Typography>
          </Box>
        </Box>

        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            Add Overlay
          </Button>
        )}
      </PageHeader>

      {/* Content */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {!loading && error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && displayedOverlays.length === 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pt: 10,
            gap: 1.5,
          }}
        >
          <LayersIcon sx={{ fontSize: 52, opacity: 0.12 }} />
          <Typography color="text.secondary" variant="body2">
            {canEdit ? 'No overlays registered yet.' : 'No overlays available.'}
          </Typography>
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setFormOpen(true)}
            >
              Add First Overlay
            </Button>
          )}
        </Box>
      )}

      {!loading && !error && displayedOverlays.length > 0 && (
        <CardGrid>
          {displayedOverlays.map((o) =>
            canEdit ? (
              <AdminOverlayCard
                key={o.id}
                overlay={o}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
                onToggle={load}
                streamers={streamers}
              />
            ) : (
              <StreamerOverlayCard
                key={o.id}
                overlay={o}
                streamers={streamers}
              />
            ),
          )}
        </CardGrid>
      )}

      {canEdit && (
        <>
          <OverlayFormDialog
            open={formOpen}
            onClose={handleCloseForm}
            initial={editTarget}
            onSaved={load}
            streamers={streamers}
            overlays={overlays}
          />
          <DeleteDialog
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            overlay={deleteTarget}
            onDeleted={load}
          />
        </>
      )}
    </Page>
  );
};

export default OverlayManager;

const Page = styled.div`
  padding: 28px 32px;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
`;

const PageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
  flex-wrap: wrap;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
`;

const Card = styled.div`
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.07);
  overflow: hidden;
  display: flex;
  transition:
    border-color 0.15s ease,
    transform 0.15s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.14);
  }
`;

const CardBody = styled.div`
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const ActiveDot = styled.div`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${({ active }) =>
    active ? '#4caf50' : 'rgba(255,255,255,0.2)'};
  box-shadow: ${({ active }) => (active ? '0 0 6px #4caf50aa' : 'none')};
`;

const ActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
`;

const RouteTag = styled.div`
  margin-top: 6px;
  font-family: monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DragWrapper = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  cursor: grab;
  user-select: none;
  transition:
    background 0.14s ease,
    color 0.14s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }

  &:active {
    cursor: grabbing;
  }
`;
