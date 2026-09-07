import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (id.includes('react-syntax-highlighter')) return 'syntax';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react-syntax-highlighter',
      'react-syntax-highlighter/dist/cjs/styles/prism',
    ],
  },
  server: {
    allowedHosts: true,
    host: true,
    port: 5173,
  },
});
