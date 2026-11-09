const LOCAL_BACKEND_TARGET = "https://127.0.0.1:8001";

/** Browser calls stay same-origin at /backend; only Vite uses this target. */
export function backendProxy(target?: string) {
  return {
    target: target?.trim() || LOCAL_BACKEND_TARGET,
    changeOrigin: true,
    secure: false,
    rewrite: (path: string) => path.replace(/^\/backend/, ""),
  };
}
