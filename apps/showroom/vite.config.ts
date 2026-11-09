import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { backendProxy } from "../shared/viteBackendProxy";

const MANIFEST = fileURLToPath(new URL("../../manifest.json", import.meta.url));
const APP_DIR = fileURLToPath(new URL(".", import.meta.url));
// The local storefront workflow reserves 5190-5199. Keep this mapping aligned
// with scripts/run-local-store-workflow.sh so the studio never proxies to stale
// standalone design ports.
const previewPorts = { basic: 5190, beauty: 5191, fashion: 5192, electronics: 5193, nexa: 5194 } as const;

const notFoundCopy = {
  ar: { title: "الصفحة غير موجودة", body: "عذرًا، تعذّر العثور على الصفحة التي تبحث عنها." },
  fr: { title: "Page introuvable", body: "Désolé, la page que vous recherchez est introuvable." },
  en: { title: "Page not found", body: "Sorry, the page you are looking for could not be found." },
} as const;

function previewNavigationGuard() {
  return {
    name: "tijarago-preview-navigation-guard",
    configureServer(server: { middlewares: { use: (handler: (request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith("/theme-preview/")) return next();

        // An iframe navigation is the only document request allowed to reach
        // a theme server. Reject top-level navigation before Vite can return
        // index.html or expose any storefront modules.
        const destination = request.headers["sec-fetch-dest"];
        if (destination === "iframe") return next();
        if (destination && destination !== "document" && destination !== "empty") return next();

        response.statusCode = 404;
        const requestedLanguage = String(request.headers["accept-language"] || "en").toLowerCase();
        const language = requestedLanguage.startsWith("ar") ? "ar" : requestedLanguage.startsWith("fr") ? "fr" : "en";
        const copy = notFoundCopy[language];
        const direction = language === "ar" ? "rtl" : "ltr";
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Vary", "Accept-Language");
        response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
        response.end(`<!doctype html><html lang="${language}" dir="${direction}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.title}</title><style>html{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827;background:#fff}body{min-height:100vh;margin:0;display:grid;place-content:center;padding:24px;text-align:center}small{color:#9ca3af;font-weight:750;letter-spacing:.22em}h1{margin:18px 0 10px;font-size:clamp(1.75rem,4vw,2.25rem);letter-spacing:-.025em}p{margin:0;color:#6b7280;line-height:1.8}</style><body><main><small>404</small><h1>${copy.title}</h1><p>${copy.body}</p></main></body></html>`);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, APP_DIR, "");

  return {
    plugins: [previewNavigationGuard(), react()],
    resolve: {
      alias: [{ find: "@manifest?raw", replacement: `${MANIFEST}?raw` }],
    },
    server: {
      port: 5178,
      host: true,
      https: {
        key: fileURLToPath(new URL("./key.pem", import.meta.url)),
        cert: fileURLToPath(new URL("./cert.pem", import.meta.url)),
      },
      proxy: {
        "/backend": backendProxy(env.VITE_BACKEND_PROXY_TARGET || env.VITE_API_URL),
        // Storefronts embedded through the local theme-preview proxy resolve
        // their API against this HTTPS origin to avoid mixed-content errors.
        "/api": backendProxy(env.VITE_BACKEND_PROXY_TARGET || env.VITE_API_URL),
        "/media": backendProxy(env.VITE_BACKEND_PROXY_TARGET || env.VITE_API_URL),
        ...Object.fromEntries(Object.entries(previewPorts).map(([key, port]) => [
          `/theme-preview/${key}`,
          {
            target: `http://127.0.0.1:${port}`,
            changeOrigin: true,
          },
        ])),
      },
    },
    build: {
      sourcemap: false,
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/react-phone-number-input") || id.includes("node_modules/libphonenumber-js")) {
              return "vendor-phone";
            }
            if (id.includes("node_modules/framer-motion") || id.includes("node_modules/motion-dom") || id.includes("node_modules/motion-utils")) {
              return "vendor-motion";
            }
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-router") ||
              id.includes("node_modules/scheduler/")
            ) {
              return "vendor-react";
            }
          },
        },
      },
    },
  };
});
