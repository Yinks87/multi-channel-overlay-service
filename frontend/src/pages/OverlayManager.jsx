import { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LayersIcon from '@mui/icons-material/Layers';
import { fetchOverlays } from '../api/overlayApi';
import api from '../api/api';
import { fetchRegisteredStreamers } from '../api/registeredStreamerApi';
import OverlayFormDialog from '../components/overlayManager/OverlayFormDialog';
import DeleteDialog from '../components/overlayManager/DeleteDialog';
import {
  AdminOverlayCard,
  StreamerOverlayCard,
} from '../components/overlayManager/OverlayCards';

const BACKEND_ORIGIN = api.defaults.baseURL;
const SSE_ENDPOINT = import.meta.env.VITE_SSE_ENDPOINT ?? '/clients';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser'));
  } catch {
    return null;
  }
}

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
  const [clientCounts, setClientCounts] = useState({});

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
    let active = true;
    setLoading(true);
    setError('');
    fetchOverlays()
      .then((data) => {
        if (active) setOverlays(data ?? []);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchRegisteredStreamers()
      .then((data) => {
        if (active) setStreamers(data ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Fetch initial client counts and keep them live via SSE
  useEffect(() => {
    api
      .get('/api/v1/overlay/client-counts')
      .then((res) => setClientCounts(res.data.data ?? {}))
      .catch(() => {});

    const source = new EventSource(
      `${BACKEND_ORIGIN}${SSE_ENDPOINT}?topics=_client-counts`,
    );
    source.addEventListener('_client-counts', (e) => {
      try {
        setClientCounts(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    });
    return () => source.close();
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
                clientCount={
                  clientCounts[`${o.route_path}/${o.entry_file}`] ?? 0
                }
              />
            ) : (
              <StreamerOverlayCard
                key={o.id}
                overlay={o}
                streamers={streamers}
                clientCount={
                  clientCounts[`${o.route_path}/${o.entry_file}`] ?? 0
                }
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
