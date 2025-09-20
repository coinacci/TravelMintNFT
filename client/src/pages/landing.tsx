import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Upload } from "lucide-react";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";

interface Stats {
  totalNFTs: number;
  totalVolume: string;
  totalHolders: number;
}

export default function Landing() {
  const isMobile = useIsMobile();

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const formatVolume = (volume: string) => {
    return parseFloat(volume).toFixed(1);
  };

  return (
    <div className={`min-h-screen bg-background ${isMobile ? 'pb-16' : ''}`}>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background"></div>
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight" style={{ color: '#0000ff' }}>
              TravelMint
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

      {/* Statistics Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 md:gap-12 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-bold text-primary mb-2" data-testid="stats-nfts">
                {stats?.totalNFTs || 0}
              </div>
              <div className="text-sm text-muted-foreground">NFTs Minted</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-bold text-accent mb-2" data-testid="stats-holders">
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