import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { backendProxy } from "../shared/viteBackendProxy";

const APP_DIR = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, APP_DIR, "");

  return {
    plugins: [react()],
    server: {
      port: 5179,
      host: true,
      https: command === "serve" ? {
        key: readFileSync(fileURLToPath(new URL("./key.pem", import.meta.url))),
        cert: readFileSync(fileURLToPath(new URL("./cert.pem", import.meta.url))),
      } : undefined,
      proxy: {
        "/backend": backendProxy(env.VITE_BACKEND_PROXY_TARGET || env.VITE_API_URL),
      },
    },
    build: {
      sourcemap: false,
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/echarts") || id.includes("node_modules/zrender")) return "vendor-charts";
            if (id.includes("node_modules/react-phone-number-input") || id.includes("node_modules/libphonenumber-js")) return "vendor-phone";
            if (id.includes("node_modules/framer-motion") || id.includes("node_modules/motion-dom") || id.includes("node_modules/motion-utils")) return "vendor-motion";
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-router") ||
              id.includes("node_modules/scheduler/")
            ) return "vendor-react";
          },
        },
      },
    },
  };
});
