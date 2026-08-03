import React from 'react';
import styled from '@emotion/styled';
import { Box, Button, Divider, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useNavigate } from 'react-router-dom';

const NoAccess = () => {
  const navigate = useNavigate();

  return (
    <Root>
      <Panel>
        <LockOutlinedIcon
          sx={{ fontSize: 48, color: 'rgba(255,255,255,0.25)', mb: 1 }}
        />

        <Typography variant="h5" fontWeight={800} textAlign="center">
          Access not allowed
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          textAlign="center"
          sx={{ mb: 1 }}
        >
          Your Twitch account is not permitted to log in at this time.
        </Typography>

        <Divider
          sx={{ width: '100%', borderColor: 'rgba(255,255,255,0.07)', my: 1 }}
        />

        <Box
          component="ul"
          sx={{
            m: 0,
            pl: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            listStyle: 'none',
            pl: 0,
          }}
        >
          <ReasonItem>
            <Bullet />
            <Typography variant="body2" color="text.secondary">
              <strong style={{ color: 'rgba(255,255,255,0.75)' }}>
                Moderator
              </strong>{' '}
              — one of your streamers must be granted the Streamer role before
              you can log in.
            </Typography>
          </ReasonItem>

          <ReasonItem>
            <Bullet />
            <Typography variant="body2" color="text.secondary">
              <strong style={{ color: 'rgba(255,255,255,0.75)' }}>
                Streamer
              </strong>{' '}
              — your account does not have the Streamer role assigned yet.
            </Typography>
          </ReasonItem>

          <ReasonItem>
            <Bullet />
            <Typography variant="body2" color="text.secondary">
              If any of the above applies, please ask an admin to set up your
              account.
            </Typography>
          </ReasonItem>
        </Box>

        <Button
          variant="outlined"
          size="small"
          sx={{
            mt: 2,
            color: 'rgba(255,255,255,0.5)',
            borderColor: 'rgba(255,255,255,0.15)',
          }}
          onClick={() => {
            localStorage.removeItem('jwt');
            localStorage.removeItem('currentUser');
            navigate('/', { replace: true });
          }}
        >
          Back to login
        </Button>
      </Panel>
    </Root>
  );
};

export default NoAccess;

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
  width: min(460px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 36px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 80, 80, 0.18);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
`;

const ReasonItem = styled(Box)`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const Bullet = styled(Box)`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 120, 120, 0.6);
  flex-shrink: 0;
  margin-top: 7px;
`;
