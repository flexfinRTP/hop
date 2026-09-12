import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  appType: "spa",
  optimizeDeps: {
    exclude: ["@hop/shared", "@hop/shared/ui"],
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
});
