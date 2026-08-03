import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DeleteIcon from '@mui/icons-material/Delete';
import LayersIcon from '@mui/icons-material/Layers';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import StorageIcon from '@mui/icons-material/Storage';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import styled from '@emotion/styled';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addAdmin,
  fetchAdmins,
  removeAdmin,
  updateAdminPermissions,
} from '../api/adminApi';

/* ── Constants ───────────────────────────────────────────────────────────── */

const PERMISSIONS = [
  {
    key: 'overlay:manage',
    label: 'Overlay Manager',
    icon: <LayersIcon sx={{ fontSize: 15 }} />,
  },
  {
    key: 'db:manage',
    label: 'Database Manager',
    icon: <StorageIcon sx={{ fontSize: 15 }} />,
  },
  {
    key: 'admin:manage',
    label: 'Admin Manager',
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 15 }} />,
  },
];

/* ── AdminCard ───────────────────────────────────────────────────────────── */

const AdminCard = ({ admin, onRemove, onPermissionChange }) => {
  const [busy, setBusy] = useState(false);
  const permissions = admin.roles.filter((r) => r.includes(':'));
  const baseRoles = admin.roles.filter((r) => !r.includes(':'));

  const handleToggle = async (key) => {
    setBusy(true);
    const next = permissions.includes(key)
      ? permissions.filter((p) => p !== key)
      : [...permissions, key];
    await onPermissionChange(admin.id, next);
    setBusy(false);
  };

  return (
    <Card>
      {/* Header row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: '14px 16px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            src={admin.twitch.profile_image_url}
            alt={admin.twitch.display_name || admin.userName}
            sx={{
              width: 38,
              height: 38,
              bgcolor: '#1a4f6e',
              color: '#309abd',
              fontWeight: 700,
              fontSize: 16,
            }}
          />
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {admin.twitch.display_name || admin.userName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.3 }}>
              {baseRoles.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  size="small"
                  color={r === 'admin' ? 'primary' : 'default'}
                  sx={{ height: 17, fontSize: 10, fontWeight: 600 }}
                />
              ))}
            </Box>
          </Box>
        </Box>
        <Tooltip title="Remove admin">
          <IconButton
            size="small"
            onClick={() => onRemove(admin.id)}
            sx={{
              color: 'rgba(255,255,255,0.3)',
              '&:hover': { color: '#ff6b6b', bgcolor: 'rgba(255,80,80,0.1)' },
            }}
          >
            <DeleteIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Permissions */}
      <Box sx={{ p: '10px 16px 14px' }}>
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255,255,255,0.35)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Permissions
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {PERMISSIONS.map((perm) => (
            <Box
              key={perm.key}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1,
                py: 0.5,
                borderRadius: '6px',
                bgcolor: permissions.includes(perm.key)
                  ? 'rgba(48,154,189,0.08)'
                  : 'transparent',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  color: permissions.includes(perm.key)
                    ? '#309abd'
                    : 'rgba(255,255,255,0.45)',
                }}
              >
                {perm.icon}
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                  {perm.label}
                </Typography>
              </Box>
              <Switch
                size="small"
                checked={permissions.includes(perm.key)}
                onChange={() => handleToggle(perm.key)}
                disabled={busy}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#309abd' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    bgcolor: '#309abd',
                  },
                }}
              />
            </Box>
          ))}
        </Box>
      </Box>
    </Card>
  );
};

/* ── AdminManager ────────────────────────────────────────────────────────── */

const AdminManager = () => {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
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
    const canAccess =
      cu?.roles?.includes('owner') || cu?.roles?.includes('admin:manage');
    if (!canAccess) {
      navigate('/main', { replace: true });
      return;
    }
    loadAdmins();
  }, [navigate]);

  const loadAdmins = async () => {
    setLoading(true);
    const data = await fetchAdmins();
    setAdmins(data ?? []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!userName.trim()) return;
    setAdding(true);
    const result = await addAdmin({
      userName: userName.trim(),
      requesterId: JSON.parse(localStorage.getItem('currentUser'))?.id,
    });
    setUserName('');
    if (result?.success) {
      await loadAdmins();
    }
    setAdding(false);
  };

  const handleRemove = async (userId) => {
    await removeAdmin({ userId });
    setAdmins((prev) => prev.filter((a) => a.id !== userId));
  };

  const handlePermissionChange = async (userId, permissions) => {
    // Optimistic update
    const snapshot = admins;
    setAdmins((prev) =>
      prev.map((a) => {
        if (a.id !== userId) return a;
        const base = a.roles.filter((r) => !r.includes(':'));
        return { ...a, roles: [...base, ...permissions] };
      }),
    );
    const result = await updateAdminPermissions({ userId, permissions });
    if (!result?.success) setAdmins(snapshot); // revert on failure
  };

  return (
    <Page>
      {/* Page header */}
      <PageHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AdminPanelSettingsIcon sx={{ color: '#309abd', fontSize: 26 }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Admin Manager
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Grant users admin access and configure their permissions
            </Typography>
          </Box>
        </Box>

        {/* Add admin form */}
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
            loading={adding}
          >
            Add Admin
          </Button>
        </AddRow>
      </PageHeader>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : admins.length === 0 ? (
        <EmptyState>
          <AdminPanelSettingsIcon
            sx={{ fontSize: 52, opacity: 0.15, mb: 1.5 }}
          />
          <Typography color="text.secondary" variant="body2">
            No admins defined yet. Add a Twitch username above.
          </Typography>
        </EmptyState>
      ) : (
        <CardGrid>
          {admins.map((admin) => (
            <AdminCard
              key={admin.id}
              admin={admin}
              onRemove={handleRemove}
              onPermissionChange={handlePermissionChange}
            />
          ))}
        </CardGrid>
      )}
    </Page>
  );
};

export default AdminManager;

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
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
`;

const Card = styled.div`
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
