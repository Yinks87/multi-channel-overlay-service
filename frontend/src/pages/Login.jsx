import { Alert, Box, Typography } from '@mui/material';
import styled from '@emotion/styled';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { startTwitchAuthorization } from '../api/twitchAuthApi';
import icon from '../assets/icon.png';

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

function normalizeReturnTo(returnTo) {
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/')) {
    return '/main';
  }

  return returnTo;
}

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState('');
  const returnTo = normalizeReturnTo(
    new URLSearchParams(location.search).get('returnTo') || '/main',
  );

  // Already holding a valid JWT → go straight to dashboard
  useEffect(() => {
    if (hasValidJwt()) navigate(returnTo, { replace: true });
  }, [navigate, returnTo]);

  useEffect(() => {
    const nextError = sessionStorage.getItem('authError');
    if (!nextError) return;

    setAuthError(nextError);
    sessionStorage.removeItem('authError');
  }, []);

  return (
    <Root>
      <Orb style={{ top: '-80px', left: '-80px', background: '#4a1a8a' }} />
      <Orb style={{ bottom: '-60px', right: '-40px', background: '#0d4f6e' }} />

      <GlassCard>
        <AppIcon src={icon} alt="App Icon" />
        {/* <AppIcon>⚡</AppIcon> */}
        <Typography
          variant="h5"
          fontWeight={800}
          sx={{ letterSpacing: '-0.5px', mb: 0.5 }}
        >
          Multi-Channel Overlay
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 4, lineHeight: 1.7 }}
        >
          Sign in with your Twitch account to access the dashboard.
        </Typography>

        {authError && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {authError}
          </Alert>
        )}

        <TwitchButton onClick={() => startTwitchAuthorization(returnTo)}>
          <TwitchIcon>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
            </svg>
          </TwitchIcon>
          login with Twitch
        </TwitchButton>
      </GlassCard>
    </Root>
  );
};

export default Login;

/* ── Styled ──────────────────────────────────────────────────────────────── */

const Root = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: radial-gradient(
    ellipse at 55% 25%,
    #160b28 0%,
    #0b0b17 55%,
    #07070f 100%
  );
  overflow: hidden;
  position: relative;
`;

const Orb = styled.div`
  position: absolute;
  width: 340px;
  height: 340px;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.35;
  pointer-events: none;
`;

const GlassCard = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 52px 44px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.035);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  box-shadow:
    0 32px 80px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  max-width: 380px;
  width: 100%;
`;

const AppIcon = styled.img`
  width: 44px;
  height: 44px;
  margin-bottom: 16px;
  filter: drop-shadow(0 0 20px rgba(145, 70, 255, 0.5));
`;
// const AppIcon = styled.div`
//   font-size: 44px;
//   line-height: 1;
//   margin-bottom: 16px;
//   filter: drop-shadow(0 0 20px rgba(145, 70, 255, 0.5));
// `;

const TwitchButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  gap: 10px;
  width: 100%;
  height: 48px;
  background: #9146ff;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.1s ease;
  font-family: inherit;

  &:hover {
    background: #7c3bdd;
  }

  &:active {
    transform: scale(0.98);
  }
`;

const TwitchIcon = styled.span`
  display: flex;
  align-items: center;
`;
