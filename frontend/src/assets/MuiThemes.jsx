import { createTheme } from '@mui/material';

export const createMuiTheme = (theme) => {
  const isLight = theme === 'light';

  return createTheme({
    palette: {
      mode: isLight ? 'light' : 'dark',
      primary: {
        main: isLight ? '#309abd' : '#309abd',
      },
      moderator: {
        main: isLight ? '#f59e0b' : '#f59e0b',
      },
      streamer: {
        main: isLight ? '#309abd' : '#309abd',
      },
      admin: {
        main: isLight ? '#7c3aed' : '#7c3aed',
      },
      owner: {
        main: isLight ? '#f93ac0' : '#f93ac0',
      },
    },
    components: {
      MuiButton: {
        defaultProps: {
          variant: 'contained',
          size: 'small',
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            // textTransform: 'capitalize',
          },
        },
      },
    },
  });
};
