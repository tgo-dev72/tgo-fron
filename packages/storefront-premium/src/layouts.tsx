import { usePremiumStorefront } from "./context";

/**
 * Layout 1: Editorial/Content-First (for lifestyle, fashion, home)
 * Hero → Lookbook → Editorial Content → Product Grid → Inspiration
 */
export function EditorialLayout({ children }: { children: React.ReactNode }) {
  const { hasFeature } = usePremiumStorefront();
  
  return (
    <div className="premium-layout editorial-layout">
      <header className="editorial-header">
        <nav className="editorial-nav">
          {hasFeature("lookbook") && <LookbookNav />}
          {hasFeature("videoCommerce") && <VideoNav />}
        </nav>
      </header>
      
      <main className="editorial-main">
        <section className="editorial-hero" aria-label="Hero">
          {children}
        </section>
        
        {hasFeature("lookbook") && (
          <section className="editorial-lookbook" aria-label="Lookbook">
            <LookbookGrid />
          </section>
        )}
        
        {hasFeature("videoCommerce") && (
          <section className="editorial-video" aria-label="Video Commerce">
            <VideoCommercePlayer />
          </section>
        )}
        
        <section className="editorial-products" aria-label="Products">
          <ProductDiscovery 
            mode="editorial"
            showQuickView={hasFeature("quickView")}
            infiniteScroll={hasFeature("infiniteScroll")}
          />
        </section>
        
        {hasFeature("personalization") && (
          <section className="editorial-personalized" aria-label="Recommended for You">
            <PersonalizedRecommendations />
          </section>
        )}
      </main>
      
      <footer className="editorial-footer">
        {hasFeature("loyaltyProgram") && <LoyaltyBar />}
      </footer>
    </div>
  );
}

/**
 * Layout 2: Technical/Spec-First (for electronics, tools, B2B)
 * Hero → Spec Comparison → Faceted Search → Data Tables → Quote Builder
 */
export function TechnicalLayout({ children }: { children: React.ReactNode }) {
  const { hasFeature } = usePremiumStorefront();
  
  return (
    <div className="premium-layout technical-layout">
      <header className="technical-header">
        <nav className="technical-nav">
          {hasFeature("compare") && <CompareNav />}
          {hasFeature("facetedSearch") && <FacetedSearchNav />}
          {hasFeature("tieredPricing") && <AccountTierBadge />}
        </nav>
      </header>
      
      <main className="technical-main">
        <section className="technical-hero" aria-label="Hero">
          {children}
        </section>
        
        {hasFeature("compare") && (
          <section className="technical-compare" aria-label="Product Comparison">
            <ComparisonTable />
          </section>
        )}
        
        {hasFeature("facetedSearch") && (
          <aside className="technical-facets" aria-label="Filters">
            <FacetedFilters />
          </aside>
        )}
        
        <section className="technical-products" aria-label="Products">
          <ProductDiscovery 
            mode="technical"
            showSpecs={true}
            showCompare={hasFeature("compare")}
            showTieredPricing={hasFeature("tieredPricing")}
          />
        </section>
        
        {hasFeature("quoteRequest") && (
          <section className="technical-quote" aria-label="Request Quote">
            <QuoteBuilder />
          </section>
        )}
      </main>
      
      <footer className="technical-footer">
        {hasFeature("accountDashboard") && <AccountQuickAccess />}
      </footer>
    </div>
  );
}

/**
 * Layout 3: Conversion-Optimized (for DTC, beauty, supplements)
 * Hero → Social Proof → Bundles → Subscription → Express Checkout
 */
export function ConversionLayout({ children }: { children: React.ReactNode }) {
  const { hasFeature } = usePremiumStorefront();
  
  return (
    <div className="premium-layout conversion-layout">
      <header className="conversion-header">
        <AnnouncementBar />
        <nav className="conversion-nav">
          {hasFeature("bundles") && <BundleNav />}
          {hasFeature("subscriptions") && <SubscribeNav />}
        </nav>
      </header>
      
      <main className="conversion-main">
        <section className="conversion-hero" aria-label="Hero">
          {children}
        </section>
        
        {hasFeature("socialProof") && (
          <section className="conversion-social-proof" aria-label="Social Proof">
            <SocialProofCarousel />
          </section>
        )}
        
        {hasFeature("bundles") && (
          <section className="conversion-bundles" aria-label="Bundles & Savings">
            <BundleBuilder />
          </section>
        )}
        
        {hasFeature("subscriptions") && (
          <section className="conversion-subscribe" aria-label="Subscribe & Save">
            <SubscriptionOffers />
          </section>
        )}
        
        <section className="conversion-products" aria-label="Products">
          <ProductDiscovery 
            mode="conversion"
            showQuickView={hasFeature("quickView")}
            showBundleUpsell={hasFeature("bundles")}
            showSubscriptionOption={hasFeature("subscriptions")}
          />
        </section>
        
        {hasFeature("abandonedCartRecovery") && (
          <section className="conversion-recovery" aria-label="Complete Your Order">
            <CartRecovery />
          </section>
        )}
      </main>
      
      <footer className="conversion-footer">
        {hasFeature("expressCheckout") && <ExpressCheckoutBar />}
      </footer>
    </div>
  );
}

/**
 * Layout 4: Marketplace/Multi-Vendor (for platforms, curated collections)
 * Hero → Curated Collections → Vendor Stories → Discovery Feed → Community
 */
export function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const { hasFeature } = usePremiumStorefront();
  
  return (
    <div className="premium-layout marketplace-layout">
      <header className="marketplace-header">
        <nav className="marketplace-nav">
          {hasFeature("curatedCollections") && <CollectionsNav />}
          {hasFeature("vendorStories") && <VendorsNav />}
          {hasFeature("community") && <CommunityNav />}
        </nav>
      </header>
      
      <main className="marketplace-main">
        <section className="marketplace-hero" aria-label="Hero">
          {children}
        </section>
        
        {hasFeature("curatedCollections") && (
          <section className="marketplace-collections" aria-label="Curated Collections">
            <CollectionsGrid />
          </section>
        )}
        
        {hasFeature("vendorStories") && (
          <section className="marketplace-vendors" aria-label="Meet the Makers">
            <VendorStories />
          </section>
        )}
        
        <section className="marketplace-discovery" aria-label="Discovery Feed">
          <ProductDiscovery 
            mode="marketplace"
            showVendor={true}
            showCuratorPick={hasFeature("curatorPicks")}
            infiniteScroll={hasFeature("infiniteScroll")}
          />
        </section>
        
        {hasFeature("community") && (
          <section className="marketplace-community" aria-label="Community">
            <CommunityFeed />
          </section>
        )}
      </main>
    </div>
  );
}

// Placeholder components - to be implemented
function LookbookNav() { return <nav className="lookbook-nav">Lookbook</nav>; }
function VideoNav() { return <nav className="video-nav">Video</nav>; }
function LookbookGrid() { return <div className="lookbook-grid">Lookbook Grid</div>; }
function VideoCommercePlayer() { return <div className="video-player">Video Player</div>; }
function ProductDiscovery(props: { mode: string; [key: string]: unknown }) {
  return <div className={`product-discovery ${props.mode}`}>Product Discovery ({props.mode})</div>;
}
function PersonalizedRecommendations() { return <div className="personalized">AI Recommendations</div>; }
function LoyaltyBar() { return <div className="loyalty-bar">Loyalty Program</div>; }
function CompareNav() { return <nav className="compare-nav">Compare</nav>; }
function FacetedSearchNav() { return <nav className="faceted-nav">Filters</nav>; }
function AccountTierBadge() { return <span className="tier-badge">Pro Tier</span>; }
function ComparisonTable() { return <div className="comparison-table">Spec Comparison</div>; }
function FacetedFilters() { return <aside className="faceted-filters">Faceted Filters</aside>; }
function QuoteBuilder() { return <div className="quote-builder">Quote Builder</div>; }
function AccountQuickAccess() { return <div className="account-access">Account Dashboard</div>; }
function AnnouncementBar() { return <div className="announcement-bar">Free shipping on orders $75+</div>; }
function BundleNav() { return <nav className="bundle-nav">Bundles</nav>; }
function SubscribeNav() { return <nav className="subscribe-nav">Subscribe</nav>; }
function SocialProofCarousel() { return <div className="social-proof">Social Proof</div>; }
function BundleBuilder() { return <div className="bundle-builder">Build Your Bundle</div>; }
function SubscriptionOffers() { return <div className="subscription-offers">Subscribe & Save</div>; }
function CartRecovery() { return <div className="cart-recovery">Complete Your Order</div>; }
function ExpressCheckoutBar() { return <div className="express-checkout">Express Checkout</div>; }
function CollectionsNav() { return <nav className="collections-nav">Collections</nav>; }
function VendorsNav() { return <nav className="vendors-nav">Vendors</nav>; }
function CommunityNav() { return <nav className="community-nav">Community</nav>; }
function CollectionsGrid() { return <div className="collections-grid">Curated Collections</div>; }
function VendorStories() { return <div className="vendor-stories">Vendor Stories</div>; }
function CommunityFeed() { return <div className="community-feed">Community Feed</div>; }