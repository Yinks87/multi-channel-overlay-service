import { Avatar, Box, Button, Chip, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { startTwitchAuthorization } from '../api/twitchAuthApi';
import styled from '@emotion/styled';

import img from '../assets/icon.png';

const Home = () => {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'twitch-auth-success') {
        const user = event.data.user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        setCurrentUser(user);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleTwitchAuth = async () => {
    await startTwitchAuthorization();
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  const isOwner = currentUser?.roles?.includes('owner');
  const isAdmin = currentUser?.roles?.includes('admin');

  return (
    <>
      <Img src={img} alt="App Icon" />
      <Container>
        <Content>
          <Typography variant="h4" gutterBottom>
            Multi-Channel Overlay Service
          </Typography>

          {!currentUser ? (
            <>
              <Typography variant="body1" gutterBottom>
                Connect your Twitch account. <br />
                If you are a registered streamer, you will be redirected to your
                overlay management page. If you are a moderator, you will be
                redirected to the overlay management page of the streamer you
                are moderating for.
              </Typography>
              <TwitchAuthButton onClick={handleTwitchAuth}>
                Connect with Twitch
              </TwitchAuthButton>
            </>
          ) : (
            <>
              <Box
                gap={2}
                mb={3}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {currentUser.profileImageUrl && (
                  <Avatar
                    src={currentUser.profileImageUrl}
                    alt={currentUser.userName}
                    sx={{ width: 56, height: 56 }}
                  />
                )}
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="h6">{currentUser.userName}</Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 0.5,
                      flexWrap: 'wrap',
                      mt: 0.5,
                    }}
                  >
                    {currentUser.roles?.map((role) => (
                      <Chip
                        key={role}
                        label={role}
                        size="small"
                        color={
                          role === 'owner'
                            ? 'warning'
                            : role === 'admin'
                              ? 'primary'
                              : 'default'
                        }
                      />
                    ))}
                  </Box>
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  alignItems: 'center',
                }}
              >
                {(isOwner || isAdmin) && (
                  <NavButton
                    variant="contained"
                    onClick={() => navigate('registered-streamers')}
                  >
                    Manage Registered Streamers
                  </NavButton>
                )}
                {isOwner && (
                  <NavButton
                    variant="contained"
                    color="warning"
                    onClick={() => navigate('admins')}
                  >
                    Manage Admins
                  </NavButton>
                )}
                <TwitchAuthButton variant="outlined" onClick={handleTwitchAuth}>
                  Re-connect Twitch
                </TwitchAuthButton>
                <Button variant="text" color="inherit" onClick={handleLogout}>
                  Logout
                </Button>
              </Box>
            </>
          )}
        </Content>
        <Outlet />
      </Container>
    </>
  );
};

export default Home;

const TwitchAuthButton = styled(Button)`
  margin-top: 20px;
  background-color: #9146ff;
  height: 50px;
  font-size: 16px;
  font-weight: bold;
  border-radius: 8px;

  &:hover {
    background-color: #772ce8;
  }
`;

const NavButton = styled(Button)`
  width: 280px;
  height: 44px;
  font-size: 15px;
  border-radius: 8px;
`;

const Img = styled.img`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.1;
  filter: blur(5px);
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
`;

const Content = styled.div`
  text-align: center;
  max-width: 600px;
  padding: 20px;
`;
