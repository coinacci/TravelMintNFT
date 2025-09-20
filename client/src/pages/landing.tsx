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
        <div className="relative container mx-auto px-4 py-8 md:py-16">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: '#0000ff' }}>
              TravelMint
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Mint your travel photography as NFTs, pin them to locations worldwide, and trade with fellow explorers. Each photo tells a story, each location holds memories.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/mint">
                <Button 
                  size="default" 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3"
                  data-testid="mint-memory-button"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Mint your Memory
                </Button>
              </Link>
              <Link href="/explore">
                <Button 
                  variant="outline" 
                  size="default" 
                  className="px-6 py-3"
                  data-testid="explore-map-button"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Explore Map
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-8 bg-muted/50">
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