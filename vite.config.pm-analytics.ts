import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Vite config for PM Analytics standalone deployment
export default defineConfig({
  root: ".",
  build: {
    outDir: "dist-pm-analytics",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index-pm-analytics.html"),
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "::",
    port: 8081,
  },
});

