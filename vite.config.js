import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite 設定：載入環境變數並注入後端 Port
export default defineConfig(({ mode }) => {
  // 載入 .env 檔案中的環境變數
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.PORT || 3001;

  return {
    plugins: [react()],
    define: {
      // 將後端 Port 注入給前端 JavaScript 使用
      'process.env.BACKEND_PORT': JSON.stringify(backendPort),
    },
    server: {
      port: 5173,
      open: true,
    },
  };
});
