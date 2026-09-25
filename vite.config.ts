import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 相对资源路径同时兼容开发服务器和 macOS .app 内的 file:// 页面。
  base: './',
  plugins: [react()],
});
