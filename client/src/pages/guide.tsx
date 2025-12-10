import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  MapPin, 
  Coffee, 
  Utensils, 
  Gem, 
  Star, 
  Lock, 
  ExternalLink,
  Phone,
  Globe,
  DollarSign,
  Landmark,
  Sparkles
} from "lucide-react";
import type { GuideCity, GuideSpot } from "@shared/schema";

interface CitySearchResponse {
  cities: GuideCity[];
  isHolder: boolean;
  totalResults?: number;
  message?: string;
}

interface CityDetailResponse {
  city: GuideCity;
  spots: GuideSpot[];
  isHolder: boolean;
  message?: string;
}

const categoryIcons = {
  landmark: Landmark,
  cafe: Coffee,
  restaurant: Utensils,
  hidden_gem: Gem,
};

const categoryLabels = {
  landmark: "Landmarks",
  cafe: "Cafes",
  restaurant: "Restaurants",
  hidden_gem: "Hidden Gems",
};

function PriceLevelBadge({ level }: { level: number | null }) {
  if (level === null || level === undefined) return null;
  const dollars = "$".repeat(level + 1);
  return (
    <Badge variant="outline" className="text-xs">
      <DollarSign className="w-3 h-3 mr-1" />
      {dollars}
    </Badge>
  );
}

function RatingBadge({ rating, count }: { rating: string | null; count: number | null }) {
  if (!rating) return null;
  return (
    <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
      <Star className="w-3 h-3 mr-1 fill-current" />
      {parseFloat(rating).toFixed(1)}
      {count && <span className="ml-1 text-xs opacity-70">({count})</span>}
    </Badge>
  );
}

function SpotCard({ spot, isHolder }: { spot: GuideSpot; isHolder: boolean }) {
  const CategoryIcon = categoryIcons[spot.category as keyof typeof categoryIcons] || Landmark;
  
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {spot.photoUrl && (
        <div className="relative h-40 overflow-hidden">
          <img 
            src={spot.photoUrl} 
            alt={spot.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2">
            <Badge className="bg-black/60 text-white">
              <CategoryIcon className="w-3 h-3 mr-1" />
              {categoryLabels[spot.category as keyof typeof categoryLabels]}
            </Badge>
          </div>
        </div>
      )}
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-2">{spot.name}</h3>
        
        <div className="flex flex-wrap gap-2 mb-3">
          <RatingBadge rating={spot.rating} count={spot.userRatingsTotal} />
          <PriceLevelBadge level={spot.priceLevel} />
        </div>
        
        {isHolder ? (
          <>
            {spot.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {spot.description}
              </p>
            )}
            
            {spot.address && (
              <p className="text-xs text-muted-foreground flex items-start gap-1 mb-2">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {spot.address}
              </p>
            )}
            
            <div className="flex flex-wrap gap-2 mt-3">
              {spot.website && (
                <Button variant="outline" size="sm" asChild>
                  <a href={spot.website} target="_blank" rel="noopener noreferrer">
                    <Globe className="w-3 h-3 mr-1" />
                    Website
                  </a>
                </Button>
              )}
              {spot.phoneNumber && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${spot.phoneNumber}`}>
                    <Phone className="w-3 h-3 mr-1" />
                    Call
                  </a>
                </Button>
              )}
              {spot.googleMapsUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={spot.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Map
                  </a>
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4" />
            <span>Own an NFT to see details</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CityCard({ city, onClick }: { city: GuideCity; onClick: () => void }) {
  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
      onClick={onClick}
      data-testid={`city-card-${city.id}`}
    >
      {city.heroImageUrl && (
        <div className="relative h-32 overflow-hidden">
          <img 
            src={city.heroImageUrl} 
            alt={city.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3">
            <h3 className="font-bold text-white text-lg">{city.name}</h3>
            <p className="text-white/80 text-sm">{city.country}</p>
          </div>
        </div>
      )}
      {!city.heroImageUrl && (
        <CardContent className="p-4">
          <h3 className="font-bold text-lg">{city.name}</h3>
          <p className="text-muted-foreground text-sm">{city.country}</p>
        </CardContent>
      )}
    </Card>
  );
}

function HolderGateMessage() {
  return (
    <Card className="border-amber-500/50 bg-amber-500/10">
      <CardContent className="p-6 text-center">
        <Sparkles className="w-12 h-12 mx-auto mb-4 text-amber-500" />
        <h3 className="font-bold text-lg mb-2">Exclusive for TravelMint NFT Holders!</h3>
        <p className="text-muted-foreground mb-4">
          Mint a TravelMint NFT to unlock all cities and detailed place information.
        </p>
        <Button asChild className="bg-amber-500 hover:bg-amber-600">
          <a href="/mint">Mint NFT</a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function GuidePage() {
  const { address } = useAccount();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const holderStatusUrl = address ? `/api/guide/holder-status?walletAddress=${address}` : null;
  const { data: holderStatus } = useQuery<{ isHolder: boolean }>({
    queryKey: ["/api/guide/holder-status", address],
    queryFn: async () => {
      if (!holderStatusUrl) return { isHolder: false };
      const res = await fetch(holderStatusUrl);
      return res.json();
    },
    enabled: !!address,
  });

  const popularUrl = `/api/guide/cities/popular${address ? `?walletAddress=${address}` : ''}`;
  const { data: popularCities, isLoading: isLoadingPopular } = useQuery<CitySearchResponse>({
    queryKey: ["/api/guide/cities/popular", address || "none"],
    queryFn: async () => {
      const res = await fetch(popularUrl);
      return res.json();
    },
  });

  const searchUrl = `/api/guide/cities/search?query=${encodeURIComponent(searchQuery)}${address ? `&walletAddress=${address}` : ''}`;
  const { data: searchResults, isLoading: isSearching } = useQuery<CitySearchResponse>({
    queryKey: ["/api/guide/cities/search", searchQuery, address || "none"],
    queryFn: async () => {
      const res = await fetch(searchUrl);
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const cityDetailUrl = selectedCityId 
    ? `/api/guide/cities/${selectedCityId}?${activeCategory !== 'all' ? `category=${activeCategory}&` : ''}${address ? `walletAddress=${address}` : ''}`
    : null;
  const { data: cityDetail, isLoading: isLoadingCity } = useQuery<CityDetailResponse>({
    queryKey: ["/api/guide/cities", selectedCityId, activeCategory, address || "none"],
    queryFn: async () => {
      if (!cityDetailUrl) throw new Error("No city selected");
      const res = await fetch(cityDetailUrl);
      return res.json();
    },
    enabled: !!selectedCityId,
  });

  const isHolder = holderStatus?.isHolder || false;
  const citiesToShow = searchQuery.length >= 2 ? searchResults?.cities : popularCities?.cities;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  if (selectedCityId && cityDetail) {
    const categories = ['all', 'landmark', 'cafe', 'restaurant', 'hidden_gem'];
    const filteredSpots = activeCategory === 'all' 
      ? cityDetail.spots 
      : cityDetail.spots.filter(s => s.category === activeCategory);

    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedCityId(null)}
          className="mb-4"
          data-testid="back-button"
        >
          ← Back
        </Button>

        <div className="mb-6">
          {cityDetail.city.heroImageUrl && (
            <div className="relative h-48 md:h-64 rounded-lg overflow-hidden mb-4">
              <img 
                src={cityDetail.city.heroImageUrl} 
                alt={cityDetail.city.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <h1 className="text-3xl font-bold text-white">{cityDetail.city.name}</h1>
                <p className="text-white/80">{cityDetail.city.country}</p>
              </div>
            </div>
          )}
          {!cityDetail.city.heroImageUrl && (
            <div className="mb-4">
              <h1 className="text-3xl font-bold">{cityDetail.city.name}</h1>
              <p className="text-muted-foreground">{cityDetail.city.country}</p>
            </div>
          )}
        </div>

        {!isHolder && (
          <div className="mb-6">
            <HolderGateMessage />
          </div>
        )}

        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="landmark" data-testid="tab-landmark">
              <Landmark className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Places</span>
            </TabsTrigger>
            <TabsTrigger value="cafe" data-testid="tab-cafe">
              <Coffee className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Cafes</span>
            </TabsTrigger>
            <TabsTrigger value="restaurant" data-testid="tab-restaurant">
              <Utensils className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Dining</span>
            </TabsTrigger>
            <TabsTrigger value="hidden_gem" data-testid="tab-hidden_gem">
              <Gem className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Gems</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoadingCity ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : (
          <>
            {filteredSpots.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No places found in this category yet.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSpots.map((spot) => (
                  <SpotCard key={spot.id} spot={spot} isHolder={isHolder} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Trip Guide</h1>
        <p className="text-muted-foreground">
          Discover the world's most beautiful cities
          {!isHolder && " • Exclusive content for NFT holders"}
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search cities... (e.g., Istanbul, Paris, Tokyo)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="city-search-input"
          />
        </div>
      </form>

      {!isHolder && !address && (
        <div className="mb-6">
          <HolderGateMessage />
        </div>
      )}

      {(searchResults?.message || popularCities?.message) && !isHolder && (
        <div className="text-center mb-4 text-sm text-amber-600 dark:text-amber-400">
          <Lock className="w-4 h-4 inline mr-1" />
          {searchResults?.message || popularCities?.message}
        </div>
      )}

      {isLoadingPopular || isSearching ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-4">
            {searchQuery.length >= 2 ? "Search Results" : "Popular Cities"}
          </h2>
          
          {citiesToShow && citiesToShow.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {citiesToShow.map((city) => (
                <CityCard 
                  key={city.id} 
                  city={city} 
                  onClick={() => setSelectedCityId(city.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery.length >= 2 
                  ? "City not found. Try a different search."
                  : "No popular cities yet. Start by searching for a city."}
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
