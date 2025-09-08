import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Upload, DollarSign, Globe, Users, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";

interface Stats {
  totalNFTs: number;
  totalVolume: string;
  totalHolders: number;
}

export default function Landing() {
  const isMobileHook = useIsMobile();
  
  // Force mobile layout for frames (consistent with Navigation)
  const isFrame = typeof window !== 'undefined' && window.parent !== window;
  const isMobile = isFrame || isMobileHook;

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  // Debug logging for Landing page
  console.log('🏠 Landing page rendering:', { 
    isMobile, 
    stats,
    isFrame: typeof window !== 'undefined' && window.parent !== window 
  });

  // Force visible content for debugging in frames
  if (isFrame) {
    console.log('🎯 FRAME DETECTED: Rendering emergency visible content');
  }

  const formatVolume = (volume: string) => {
    return parseFloat(volume).toFixed(1);
  };

  // NUCLEAR OPTION: Raw HTML injection bypass React completely
  // TEMPORARILY disable frame check for testing
  if (true) { // Always show debug content for testing
    console.log('🚨 NUCLEAR TEST: Bypassing React completely');
    
    // Method 1: Direct DOM manipulation
    if (typeof document !== 'undefined') {
      console.log('🔥 Direct DOM injection starting...');
      
      // Clear and inject into body directly
      setTimeout(() => {
        const testDiv = document.createElement('div');
        testDiv.innerHTML = `
          <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #ff0000; color: white; font-size: 24px; z-index: 999999; padding: 20px;">
            🚨 DIRECT DOM INJECTION TEST<br>
            If you see this RED text, React bypass worked!<br>
            Frame: YES<br>
            Time: ${new Date().toLocaleTimeString()}
          </div>
        `;
        document.body.appendChild(testDiv);
        console.log('✅ Direct DOM element injected');
      }, 100);
      
      // Method 2: Document write test  
      setTimeout(() => {
        document.body.style.backgroundColor = '#ff0000';
        document.body.style.color = 'white';
        document.body.style.fontSize = '20px';
        console.log('✅ Body style modified directly');
      }, 200);
    }
    
    // Method 3: Still return React content as fallback
    return (
      <div 
        dangerouslySetInnerHTML={{
          __html: `
            <div style="background: #00ff00; color: black; padding: 30px; font-size: 22px; border: 5px solid red;">
              ⚡ REACT FALLBACK - Green Block<br>
              Frame detected: YES<br>
              If you see this, React is working but CSS might be blocked
            </div>
          `
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-16' : ''}`}>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background"></div>
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight" style={{ color: '#0000ff' }}>
              Travel NFT
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Mint your travel photography as NFTs, pin them to locations worldwide, and trade with fellow explorers. Each photo tells a story, each location holds memories.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/mint">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg"
                  data-testid="mint-memory-button"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Mint your Memory
                </Button>
              </Link>
              <Link href="/explore">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="px-8 py-4 text-lg"
                  data-testid="explore-map-button"
                >
                  <MapPin className="w-5 h-5 mr-2" />
                  Explore Map
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How TravelNFT Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Simple steps to immortalize your travel memories on the blockchain
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Upload & Locate</h3>
                <p className="text-muted-foreground">
                  Upload your travel photos and pin them to the exact location where they were taken
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 mx-auto mb-6 bg-accent/10 rounded-full flex items-center justify-center">
                  <DollarSign className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Mint for 1 USDC</h3>
                <p className="text-muted-foreground">
                  Transform your photo into an NFT for just 1 USDC. Simple, affordable, and instant.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
                  <Globe className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Trade & Explore</h3>
                <p className="text-muted-foreground">
                  Your NFT stays pinned to its location forever. Trade with others and discover new places.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Explore Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Explore the World Through NFTs
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Discover amazing travel photography from around the globe, each NFT pinned to its original location
            </p>
            
            <Card className="mb-8">
              <CardContent className="pt-8 pb-6">
                <Globe className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-3">Interactive World Map</h3>
                <p className="text-muted-foreground mb-6">
                  Explore NFT photos pinned to locations worldwide
                </p>
                <Link href="/explore">
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    data-testid="explore-map-cta-button"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Explore Map
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2" data-testid="stats-nfts">
                {stats?.totalNFTs || 0}
              </div>
              <div className="text-sm text-muted-foreground">NFTs Minted</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-accent mb-2" data-testid="stats-holders">
                {stats?.totalHolders || 0}
              </div>
              <div className="text-sm text-muted-foreground">Holders</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}