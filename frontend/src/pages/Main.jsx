import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DescriptionIcon from '@mui/icons-material/Description';
import LayersIcon from '@mui/icons-material/Layers';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import LogoutIcon from '@mui/icons-material/Logout';
import StorageIcon from '@mui/icons-material/Storage';
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import styled from '@emotion/styled';
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  {
    label: 'Streamers',
    path: '/main/streamers',
    icon: <LiveTvIcon sx={{ fontSize: 18 }} />,
    allowedRoles: ['owner', 'admin'],
  },
  {
    label: 'Admins',
    path: '/main/admins',
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 18 }} />,
    allowedRoles: ['owner', 'admin:manage'],
  },
  {
    label: 'Overlays',
    path: '/main/overlay',
    icon: <LayersIcon sx={{ fontSize: 18 }} />,
    allowedRoles: ['owner', 'overlay:manage', 'overlay:read'],
  },
  {
    label: 'Database',
    path: '/main/db',
    icon: <StorageIcon sx={{ fontSize: 18 }} />,
    allowedRoles: ['owner', 'db:manage'],
  },
  {
    label: 'Docs',
    path: '/main/docs',
    icon: <DescriptionIcon sx={{ fontSize: 18 }} />,
    allowedRoles: ['owner', 'db:manage'],
  },
];

/** Returns true when a stored JWT exists and has not yet expired. */
function hasValidJwt() {
  try {
    const token = localStorage.getItem('jwt');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

const Main = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('currentUser'));
    } catch {
      return null;
    }
  })();

  // Guard: not logged in or JWT expired → back to login
  useEffect(() => {
    if (!hasValidJwt()) {
      localStorage.removeItem('jwt');
      localStorage.removeItem('currentUser');
      const returnTo = `${location.pathname}${location.search}`;
      navigate(`/?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const userRoles = currentUser?.roles ?? [];
  const displayRoles = userRoles.filter((r) => !r.includes(':'));

  const visibleNav = NAV_ITEMS.filter((item) =>
    item.allowedRoles.some((r) => userRoles.includes(r)),
  );

  // Redirect /main to the first accessible section
  useEffect(() => {
    if (location.pathname === '/main' && visibleNav.length > 0) {
      navigate(visibleNav[0].path, { replace: true });
    }
  }, [location.pathname, navigate, visibleNav]);

  const handleLogout = () => {
    localStorage.removeItem('jwt');
    localStorage.removeItem('currentUser');
    navigate('/', { replace: true });
  };

  const initials = currentUser?.userName?.[0]?.toUpperCase() ?? '?';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // close sidebar after navigation on mobile (no-op on desktop)
  const handleNavClick = (path) => { navigate(path); setSidebarOpen(false); };

  const sidebarContent = (onNavClick) => (
    <>
      <SidebarTop>
        <AppTitle>
          <Typography
            variant="caption"
            sx={{
              opacity: 0.45,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Multi-Channel
          </Typography>
          <Typography
            variant="subtitle1"
            fontWeight={800}
            sx={{ lineHeight: 1.1, letterSpacing: '-0.3px' }}
          >
            Overlay Service
          </Typography>
        </AppTitle>

        <UserCard>
          <Avatar
            src={currentUser?.profileImageUrl}
            sx={{
              width: 44,
              height: 44,
              fontWeight: 700,
              bgcolor: '#309abd',
              fontSize: 18,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {currentUser?.userName}
            </Typography>
            <Box
              sx={{ display: 'flex', gap: 0.5, mt: 0.4, flexWrap: 'wrap' }}
            >
              {displayRoles.map((r) => {
                const colorMap = {
                  owner: theme.palette.owner.main,
                  streamer: theme.palette.streamer.main,
                  moderator: theme.palette.moderator.main,
                  admin: theme.palette.admin.main,
                };

                return (
                  <Chip
                    key={r}
                    label={r}
                    size="small"
                    sx={{
                      height: 17,
                      fontSize: 10,
                      fontWeight: 700,
                      bgcolor: `${colorMap[r] ?? '#555'}22`,
                      color: colorMap[r] ?? '#aaa',
                      border: `1px solid ${colorMap[r] ?? '#555'}55`,
                      textTransform: 'capitalize',
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        </UserCard>

        <Divider
          sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 1, mb: 1 }}
        />

        <NavList>
          {visibleNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Tooltip
                key={item.path}
                title={item.label}
                placement="right"
                disableHoverListener
              >
                <Box
                  onClick={() => onNavClick(item.path)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 1.5,
                    py: '9px',
                    mx: 0.5,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: active ? 600 : 400,
                    color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                    bgcolor: active ? 'rgba(48,154,189,0.14)' : 'transparent',
                    borderLeft: `3px solid ${active ? '#309abd' : 'transparent'}`,
                    transition: 'all 0.14s ease',
                    userSelect: 'none',
                    '&:hover': {
                      bgcolor: active
                        ? 'rgba(48,154,189,0.2)'
                        : 'rgba(255,255,255,0.05)',
                      color: '#fff',
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      color: active ? '#309abd' : 'inherit',
                      transition: 'color 0.14s ease',
                    }}
                  >
                    {item.icon}
                  </Box>
                  {item.label}
                </Box>
              </Tooltip>
            );
          })}
        </NavList>
      </SidebarTop>

      <SidebarBottom>
        <Divider
          sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 1, mb: 1 }}
        />
        <Box
          onClick={handleLogout}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 1.5,
            py: '9px',
            mx: 0.5,
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13.5px',
            color: 'rgba(255,255,255,0.4)',
            transition: 'all 0.14s ease',
            userSelect: 'none',
            '&:hover': { bgcolor: 'rgba(255,80,80,0.1)', color: '#ff6b6b' },
          }}
        >
          <LogoutIcon sx={{ fontSize: 18 }} />
          Logout
        </Box>
      </SidebarBottom>
    </>
  );

  return (
    <Layout>
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <Sidebar className={sidebarOpen ? 'open' : ''}>
        {sidebarContent(handleNavClick)}
      </Sidebar>
      <SidebarBackdrop
        className={sidebarOpen ? 'visible' : ''}
        onClick={() => setSidebarOpen(false)}
      />
      <MenuToggleBtn onClick={() => setSidebarOpen((p) => !p)}>
        {sidebarOpen ? (
          <CloseIcon sx={{ fontSize: 20 }} />
        ) : (
          <MenuIcon sx={{ fontSize: 20 }} />
        )}
      </MenuToggleBtn>

      {/* ── Content ───────────────────────────────────────────── */}
      <ContentArea>
        <Outlet />
      </ContentArea>
    </Layout>
  );
};

export default Main;

/* ── Styled ──────────────────────────────────────────────────────────────── */

const SIDEBAR_W = 220;

const Layout = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #0c0c14;
`;

const Sidebar = styled.nav`
  width: ${SIDEBAR_W}px;
  min-width: ${SIDEBAR_W}px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #101019;
  border-right: 1px solid rgba(255, 255, 255, 0.055);

  @media (max-width: 768px) {
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    z-index: 1200;
    transform: translateX(-100%);
    transition: transform 0.25s ease;

    &.open {
      transform: translateX(0);
    }
  }
`;

const SidebarTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  overflow-y: auto;
`;

const SidebarBottom = styled.div`
  padding-bottom: 8px;
`;

const AppTitle = styled.div`
  padding: 22px 18px 16px;
`;

const UserCard = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 14px;
`;

const NavList = styled.div`
  padding: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const SidebarBackdrop = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1100;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;

    &.visible {
      opacity: 1;
      pointer-events: auto;
    }
  }
`;

const MenuToggleBtn = styled.button`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 1300;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: #101019;
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;

    &:hover {
      background: rgba(48, 154, 189, 0.2);
      color: #fff;
    }
  }
`;

const ContentArea = styled.main`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #0c0c14;
`;
