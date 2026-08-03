import { Box, CircularProgress, Typography } from '@mui/material';
import styled from '@emotion/styled';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function normalizeReturnTo(returnTo) {
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/')) {
    return '/main';
  }

  return returnTo;
}

const TwitchAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const returnTo = normalizeReturnTo(params.get('returnTo'));
    const error = params.get('error');
    const jwt = params.get('jwt');
    const user = params.get('user');

    if (error === 'no_access') {
      localStorage.removeItem('jwt');
      localStorage.removeItem('currentUser');
      navigate('/no-access', { replace: true });
      return;
    }

    if (error) {
      sessionStorage.setItem('authError', error);
      navigate(`/?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
      return;
    }

    if (!jwt || !user) {
      sessionStorage.setItem(
        'authError',
        'Incomplete Twitch authentication response',
      );
      navigate(`/?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
      return;
    }

    try {
      const parsedUser = JSON.parse(user);
      localStorage.setItem('jwt', jwt);
      localStorage.setItem('currentUser', JSON.stringify(parsedUser));
      window.history.replaceState(null, '', window.location.pathname);
      navigate(returnTo, { replace: true });
    } catch {
      sessionStorage.setItem(
        'authError',
        'Failed to read Twitch authentication response',
      );
      navigate(`/?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [navigate]);

  return (
    <Root>
      <Panel>
        <CircularProgress size={28} />
        <Typography variant="h6" fontWeight={700}>
          Completing Twitch sign-in
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You will be redirected automatically.
        </Typography>
      </Panel>
    </Root>
  );
};

export default TwitchAuthCallback;

const Root = styled(Box)`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    circle at top,
    #1c1135 0%,
    #0b0b17 55%,
    #07070f 100%
  );
`;

const Panel = styled(Box)`
  width: min(420px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 32px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
`;
