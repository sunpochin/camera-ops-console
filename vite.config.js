import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite 設定：設定開發伺服器代理 (Proxy)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.PORT || 3001;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      open: true,
      allowedHosts: 'all',
      proxy: {
        // 代理 REST API 請求
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        // 代理行動版靜態網頁
        '/mobile': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        // 代理 WebSocket 信令與事件連線
        '/ws': {
          target: `ws://localhost:${backendPort}`,
          ws: true,
          rewrite: (path) => path.replace(/^\/ws/, ''),
        },
      },
    },
  };
});
