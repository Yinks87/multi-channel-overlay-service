import DeleteIcon from '@mui/icons-material/Delete';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  addRegisteredStreamer,
  fetchRegisteredStreamers,
  removeRegisteredStreamer,
  setStreamerConnected,
} from '../api/registeredStreamerApi';
import styled from '@emotion/styled';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── StreamerCard ────────────────────────────────────────────────────────── */

const StreamerCard = ({ streamer, onRemove, onToggleConnected }) => {
  const baseRoles = streamer.roles?.filter((r) => !r.includes(':')) ?? [];

  return (
    <Card>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar
          src={streamer.twitch.profile_image_url}
          alt={streamer.twitch.display_name || streamer.userName}
          sx={{
            width: 38,
            height: 38,
            bgcolor: '#1e3a1e',
            color: '#4caf50',
            fontWeight: 700,
            fontSize: 16,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {streamer.twitch.display_name || streamer.userName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.3, flexWrap: 'wrap' }}>
            {baseRoles.map((r) => (
              <Chip
                key={r}
                label={r}
                size="small"
                color={r === 'streamer' ? 'success' : 'default'}
                sx={{ height: 17, fontSize: 10, fontWeight: 600 }}
              />
            ))}
          </Box>
        </Box>
        {!streamer.twitch.hasAccessToken && (
          <Tooltip title="Streamer hasn't logged in yet — EventSub not connected">
            <WarningAmberIcon sx={{ fontSize: 18, color: '#ff9800', flexShrink: 0 }} />
          </Tooltip>
        )}
        <Tooltip title={streamer.connected ? 'Disconnect EventSub' : 'Connect EventSub'}>
          <Switch
            size="small"
            checked={!!streamer.connected}
            onChange={(e) => onToggleConnected(streamer.id, e.target.checked)}
            disabled={!streamer.twitch.hasAccessToken}
            color="success"
          />
        </Tooltip>
        <Tooltip title="Remove streamer">
          <IconButton
            size="small"
            onClick={() => onRemove(streamer.id)}
            sx={{
              color: 'rgba(255,255,255,0.3)',
              '&:hover': { color: '#ff6b6b', bgcolor: 'rgba(255,80,80,0.1)' },
            }}
          >
            <DeleteIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Card>
  );
};

/* ── StreamerManager ─────────────────────────────────────────────────────── */

const StreamerManager = () => {
  const navigate = useNavigate();
  const [streamers, setStreamers] = useState([]);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const cu = (() => {
      try {
        return JSON.parse(localStorage.getItem('currentUser'));
      } catch {
        return null;
      }
    })();

    const canManage =
      cu?.roles?.includes('owner') || cu?.roles?.includes('admin');
    if (!canManage) {
      navigate('/main', { replace: true });
      return;
    }
    loadStreamers();
  }, [navigate]);

  const loadStreamers = async () => {
    setLoading(true);
    const data = await fetchRegisteredStreamers();
    console.log('Fetched registered streamers:', data);
    setStreamers(data ?? []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!userName.trim()) return;
    setAdding(true);
    const result = await addRegisteredStreamer({
      userName: userName.trim(),
      requesterId: JSON.parse(localStorage.getItem('currentUser'))?.id,
    });
    setUserName('');
    if (result?.success) {
      await loadStreamers();
    }
    setAdding(false);
  };

  const handleRemove = async (userId) => {
    await removeRegisteredStreamer({ userId });
    setStreamers((prev) => prev.filter((s) => s.id !== userId));
  };

  const handleToggleConnected = async (userId, connected) => {
    setStreamers((prev) =>
      prev.map((s) => (s.id === userId ? { ...s, connected } : s)),
    );
    const result = await setStreamerConnected({ userId, connected });
    if (!result?.success) {
      // Revert on failure
      setStreamers((prev) =>
        prev.map((s) => (s.id === userId ? { ...s, connected: !connected } : s)),
      );
    }
  };

  const handlePermissionChange = async (userId, permissions) => {
    const snapshot = streamers;
    setStreamers((prev) =>
      prev.map((s) => {
        if (s.id !== userId) return s;
        const base = s.roles.filter((r) => !r.includes(':'));
        return { ...s, roles: [...base, ...permissions] };
      }),
    );
    const result = await updateStreamerPermissions({ userId, permissions });
    if (!result?.success) setStreamers(snapshot);
  };

  return (
    <Page>
      {/* Page header */}
      <PageHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LiveTvIcon sx={{ color: '#4caf50', fontSize: 26 }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Streamer Manager
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {streamers.length} registered streamer
              {streamers.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>

        <AddRow>
          <TextField
            placeholder="Twitch username"
            size="small"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            sx={{ width: 220 }}
          />
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={handleAdd}
            disabled={adding || !userName.trim()}
          >
            Add Streamer
          </Button>
        </AddRow>
      </PageHeader>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : streamers.length === 0 ? (
        <EmptyState>
          <LiveTvIcon sx={{ fontSize: 52, opacity: 0.15, mb: 1.5 }} />
          <Typography color="text.secondary" variant="body2">
            No registered streamers yet. Add a Twitch username above.
          </Typography>
        </EmptyState>
      ) : (
        <CardGrid>
          {streamers.map((streamer) => (
            <StreamerCard
              key={streamer.id}
              streamer={streamer}
              onRemove={handleRemove}
              onToggleConnected={handleToggleConnected}
              onPermissionChange={handlePermissionChange}
            />
          ))}
        </CardGrid>
      )}
    </Page>
  );
};

export default StreamerManager;

/* ── Styled ──────────────────────────────────────────────────────────────── */

const Page = styled.div`
  padding: 28px 32px;
  max-width: 1100px;
`;

const PageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
  flex-wrap: wrap;
`;

const AddRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
`;

const Card = styled.div`
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  transition: border-color 0.15s ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 80px;
  text-align: center;
`;
