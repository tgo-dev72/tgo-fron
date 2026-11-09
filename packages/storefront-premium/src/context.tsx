import { createContext, useContext, useMemo, ReactNode } from "react";
import type { FeatureConfig, Tier, FeatureFlag } from "./features";
import { STANDARD_FEATURES } from "./features";
import type { StoreConfig } from "@storefront/core";

interface PremiumStorefrontContextValue {
  tier: Tier;
  features: FeatureConfig;
  hasFeature: (flag: FeatureFlag) => boolean;
  storeConfig: StoreConfig;
}

const PremiumStorefrontContext = createContext<PremiumStorefrontContextValue | null>(null);

export function PremiumStorefrontProvider({
  children,
  tier = "standard",
  featureFlags,
  storeConfig,
}: {
  children: ReactNode;
  tier?: Tier;
  featureFlags: readonly FeatureFlag[];
  storeConfig: StoreConfig;
}) {
  const features = useMemo(() => {
    const scopedFeatures: FeatureConfig = { ...STANDARD_FEATURES };
    for (const flag of featureFlags) scopedFeatures[flag] = true;
    return scopedFeatures;
  }, [featureFlags]);

  const hasFeature = (flag: FeatureFlag) => features[flag] === true;

  return (
    <PremiumStorefrontContext.Provider value={{ tier, features, hasFeature, storeConfig }}>
      {children}
    </PremiumStorefrontContext.Provider>
  );
}

export function usePremiumStorefront() {
  const ctx = useContext(PremiumStorefrontContext);
  if (!ctx) throw new Error("usePremiumStorefront must be used within PremiumStorefrontProvider");
  return ctx;
}

export function useFeature(flag: FeatureFlag) {
  const { hasFeature } = usePremiumStorefront();
  return hasFeature(flag);
}
