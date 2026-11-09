/**
 * Premium Feature Flags — defines what capabilities each tier unlocks.
 * Standard tier gets basic commerce; Premium tier gets advanced UX patterns.
 */

export type FeatureFlag =
  | "wishlist"
  | "compare"
  | "recentlyViewed"
  | "bundles"
  | "subscriptions"
  | "lookbook"
  | "sizeGuide"
  | "videoCommerce"
  | "quickView"
  | "infiniteScroll"
  | "facetedSearch"
  | "visualSearch"
  | "instantSearch"
  | "personalization"
  | "recommendations"
  | "loyaltyProgram"
  | "tieredPricing"
  | "quoteRequest"
  | "quoteBuilder"
  | "accountDashboard"
  | "orderHistory"
  | "reorder"
  | "expressCheckout"
  | "multiStepCheckout"
  | "guestCheckout"
  | "savedAddresses"
  | "paymentMethods"
  | "giftWrapping"
  | "scheduledDelivery"
  | "pickupPoints"
  | "liveChat"
  | "aiRecommendations"
  | "abandonedCartRecovery"
  | "socialProof"
  | "curatedCollections"
  | "vendorStories"
  | "curatorPicks"
  | "community";

export interface FeatureConfig {
  [key: string]: boolean;
}

export const STANDARD_FEATURES: FeatureConfig = {
  wishlist: false,
  compare: false,
  recentlyViewed: false,
  bundles: false,
  subscriptions: false,
  lookbook: false,
  sizeGuide: false,
  videoCommerce: false,
  quickView: false,
  infiniteScroll: false,
  facetedSearch: false,
  visualSearch: false,
  instantSearch: false,
  personalization: false,
  recommendations: false,
  loyaltyProgram: false,
  tieredPricing: false,
  quoteRequest: false,
  quoteBuilder: false,
  accountDashboard: false,
  orderHistory: false,
  reorder: false,
  expressCheckout: false,
  multiStepCheckout: true,
  guestCheckout: true,
  savedAddresses: false,
  paymentMethods: false,
  giftWrapping: false,
  scheduledDelivery: false,
  pickupPoints: false,
  liveChat: false,
  aiRecommendations: false,
  abandonedCartRecovery: false,
  socialProof: false,
  curatedCollections: false,
  vendorStories: false,
  curatorPicks: false,
  community: false,
};

export const PREMIUM_FEATURES: FeatureConfig = {
  wishlist: true,
  compare: true,
  recentlyViewed: true,
  bundles: true,
  subscriptions: true,
  lookbook: true,
  sizeGuide: true,
  videoCommerce: true,
  quickView: true,
  infiniteScroll: true,
  facetedSearch: true,
  visualSearch: true,
  instantSearch: true,
  personalization: true,
  recommendations: true,
  loyaltyProgram: true,
  tieredPricing: true,
  quoteRequest: true,
  quoteBuilder: true,
  accountDashboard: true,
  orderHistory: true,
  reorder: true,
  expressCheckout: true,
  multiStepCheckout: true,
  guestCheckout: true,
  savedAddresses: true,
  paymentMethods: true,
  giftWrapping: true,
  scheduledDelivery: true,
  pickupPoints: true,
  liveChat: true,
  aiRecommendations: true,
  abandonedCartRecovery: true,
  socialProof: true,
  curatedCollections: true,
  vendorStories: true,
  curatorPicks: true,
  community: true,
};

export type Tier = "standard" | "premium";
export type FeatureMaturity = "production" | "beta" | "prototype";

export interface CapabilityManifest {
  features?: readonly string[];
  feature_maturity?: Record<string, string>;
}

const KNOWN_FEATURES = new Set(Object.keys(PREMIUM_FEATURES));

/**
 * Returns only capabilities that are both known by the application and
 * explicitly certified for production in the design manifest. Beta and
 * prototype work can live in the repository without becoming merchant-facing.
 */
export function productionFeatures(manifest: CapabilityManifest): FeatureFlag[] {
  return (manifest.features ?? []).filter(
    (feature): feature is FeatureFlag =>
      KNOWN_FEATURES.has(feature) && manifest.feature_maturity?.[feature] === "production",
  );
}

export function getFeaturesForTier(tier: Tier): FeatureConfig {
  return tier === "premium" ? PREMIUM_FEATURES : STANDARD_FEATURES;
}

export function hasFeature(features: FeatureConfig, flag: FeatureFlag): boolean {
  return features[flag] === true;
}
