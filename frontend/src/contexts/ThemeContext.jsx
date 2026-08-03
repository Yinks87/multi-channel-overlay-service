import React, { createContext, useEffect, useMemo, useState } from 'react';
import {
  CssBaseline,
  ThemeProvider as MuiThemeProvider,
} from '@mui/material';
import { createMuiTheme } from '../assets/MuiThemes';

export const ThemeContext = createContext();

export const ThemeProvider = ({ initialMode = 'system', children }) => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const [systemPrefersDark, setSystemPrefersDark] = useState(mediaQuery.matches);
  const [theme, setTheme] = useState(() => {
    const stored = window.localStorage.getItem('theme');
    if (stored) return stored;
    if (initialMode === 'system') return mediaQuery.matches ? 'dark' : 'light';
    return initialMode;
  });

  useEffect(() => {
    const handler = (e) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem('theme');
    if (!stored) {
      setTheme(systemPrefersDark ? 'dark' : 'light');
    }
  }, [systemPrefersDark]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    window.localStorage.setItem('theme', next);
  };

  const muiTheme = useMemo(() => createMuiTheme(theme), [theme]);

  const value = { theme, toggleTheme };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
