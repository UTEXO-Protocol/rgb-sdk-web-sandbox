import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react()],
    // Keep the WASM module's import.meta.url intact in development. The
    // production build emits its new URL(...wasm, import.meta.url) asset.
    optimizeDeps: { exclude: ['@utexo/rgb-sdk-web', '@utexo/rgb-lib-wasm'] },
    server: {
      port: 5173,
      proxy: {
        '/rgb-l1-regtest': {
          target: env.VITE_RGB_L1_HELPER_TARGET || 'http://127.0.0.1:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/rgb-l1-regtest/, ''),
        },
        '/rgb-l1-esplora': {
          target: env.VITE_RGB_L1_INDEXER_TARGET || 'http://127.0.0.1:8094',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/rgb-l1-esplora/, ''),
        },
        '/rgb-l1-proxy': {
          target: env.VITE_RGB_L1_PROXY_TARGET || 'http://127.0.0.1:3002',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/rgb-l1-proxy/, ''),
        },
        '/vss': {
          target: env.VITE_RGB_L1_VSS_TARGET || 'http://127.0.0.1:8181',
          changeOrigin: true,
        },
      },
    },
  };
});
