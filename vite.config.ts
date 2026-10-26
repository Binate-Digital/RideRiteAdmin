
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ["riderite-admin.deployment-uat.com"],
  },
  // Production build served in UAT by `vite preview` (see Dockerfile)
  preview: {
    port: 5173,
    host: true,
    allowedHosts: ["riderite-admin.deployment-uat.com"],
  },
});
