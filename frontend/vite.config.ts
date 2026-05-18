import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: backendTarget, changeOrigin: true },
      "/api-auth": { target: backendTarget, changeOrigin: true },
      "/admin": { target: backendTarget, changeOrigin: true },
      "/media": { target: backendTarget, changeOrigin: true },
    },
  },
});
