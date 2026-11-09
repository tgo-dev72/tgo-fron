import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const CORE_PKG = fileURLToPath(new URL("../../packages/storefront-core", import.meta.url));
const CORE_ENTRY = fileURLToPath(new URL("../../packages/storefront-core/src/index.ts", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.BASE_PATH ?? "/";
  const port = Number(env.PORT ?? 5176);
  return {
    plugins: [react()],
    base,
    server: {
      port,
      host: true,
      https: env.LOCAL_HTTPS === "1" ? {
        key: fileURLToPath(new URL("../../apps/dashboard/key.pem", import.meta.url)),
        cert: fileURLToPath(new URL("../../apps/dashboard/cert.pem", import.meta.url)),
      } : undefined,
      proxy: env.LOCAL_BACKEND_TARGET ? {
        "/api": {
          target: env.LOCAL_BACKEND_TARGET,
          changeOrigin: true,
          secure: false,
        },
      } : undefined,
    },
    build: { sourcemap: false },
    resolve: {
      alias: [
        { find: /^@storefront\/core$/, replacement: CORE_ENTRY },
        { find: /^@storefront\/core\/(.+)$/, replacement: `${CORE_PKG}/src/$1` },
      ],
    },
  };
});
