import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AlertProvider } from './contexts/AlertContext';

const RootProvider = ({ children }) => {
  return (
    <AlertProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AlertProvider>
  );
};

export default RootProvider;
