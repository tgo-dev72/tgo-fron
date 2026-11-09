import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { StoreConfig } from "../config";

const StoreConfigContext = createContext<StoreConfig | null>(null);

export function StoreConfigProvider({ value, children }: { value: StoreConfig; children: ReactNode }) {
  return <StoreConfigContext.Provider value={value}>{children}</StoreConfigContext.Provider>;
}

/** The current store's config. Only available inside a <Storefront>. */
export function useStoreConfig(): StoreConfig {
  const config = useContext(StoreConfigContext);
  if (!config) throw new Error("useStoreConfig must be used within a <Storefront>");
  return config;
}
