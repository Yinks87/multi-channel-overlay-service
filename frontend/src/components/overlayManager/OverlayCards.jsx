import { useState } from 'react';
import styled from '@emotion/styled';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Switch,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { updateOverlay } from '../../api/overlayApi';
import { useAlert } from '../../contexts/AlertContext';
import api from '../../api/api';
import { normalizeParams } from './lib';

const BACKEND_ORIGIN = api.defaults.baseURL;
const SERVICE_URL =
  import.meta.env.VITE_BASE_OVERLAY_SERVICE_URL ?? '/overlay-service';

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

const OverlayActions = ({ url, dragUrl, active, webOverlay = false }) => {
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
        {!webOverlay ? (
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
        ) : (
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
            onClick={() => window.open(url, '_blank')}
            color={copied ? 'success' : 'inherit'}
            sx={{ flex: 1, fontSize: 11, minWidth: 0 }}
          >
            Open in Browser
          </Button>
        )}
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

      {!webOverlay && (
        <Tooltip title="Drag into OBS as a Browser Source" placement="top">
          <DragWrapper draggable onDragStart={handleDragStart}>
            <DragIndicatorIcon sx={{ fontSize: 14 }} />
            Drag to OBS
          </DragWrapper>
        </Tooltip>
      )}
    </ActionRow>
  );
};

const ClientCountBadge = ({ count }) => {
  return (
    <Tooltip title={`${count} client${count !== 1 ? 's' : ''} connected`}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.4,
          color: count > 0 ? '#4caf50' : '#535453',
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        <PeopleAltIcon sx={{ fontSize: 13 }} />
        {count}
      </Box>
    </Tooltip>
  );
};

export const AdminOverlayCard = ({
  overlay,
  onEdit,
  onDelete,
  onToggle,
  streamers = [],
  clientCount = 0,
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
            <ClientCountBadge count={clientCount} />
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
          webOverlay={overlay.web_overlay}
          dragUrl={createDragUrl(overlay)}
          active={overlay.active}
        />
      </CardBody>
    </Card>
  );
};

export const StreamerOverlayCard = ({
  overlay,
  streamers = [],
  clientCount = 0,
}) => {
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
          <ClientCountBadge count={clientCount} />
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
          webOverlay={overlay.web_overlay}
        />
      </CardBody>
    </Card>
  );
};

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
