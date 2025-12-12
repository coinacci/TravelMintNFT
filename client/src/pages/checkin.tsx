import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, Coffee, Utensils, Camera, Building, Trees, History, Navigation, CheckCircle2, Loader2, MapPinned } from "lucide-react";
import { useAccount } from "wagmi";
import { useFarcasterAuth } from "@/hooks/use-farcaster-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface POI {
  osmId: string;
  name: string;
  category: string;
  subcategory: string;
  lat: number;
  lon: number;
  address?: string;
  openingHours?: string;
  website?: string;
  phone?: string;
  cuisine?: string;
}

interface Checkin {
  id: string;
  wallet_address: string;
  osm_id: string;
  place_name: string;
  place_category: string;
  place_subcategory?: string;
  latitude: string;
  longitude: string;
  points_earned: number;
  created_at: string;
}

interface CheckinStats {
  totalCheckins: number;
  uniquePlaces: number;
  totalPoints: number;
  categoryCounts: { place_category: string; count: string }[];
}

const categoryIcons: Record<string, typeof Coffee> = {
  'Mekan': Building,
  'Turizm': Camera,
  'Mağaza': Building,
  'Eğlence': Trees,
  'Tarihi': History,
  'Diğer': MapPin,
};

const categoryColors: Record<string, string> = {
  'Mekan': 'bg-blue-500',
  'Turizm': 'bg-amber-500',
  'Mağaza': 'bg-purple-500',
  'Eğlence': 'bg-green-500',
  'Tarihi': 'bg-orange-500',
  'Diğer': 'bg-gray-500',
};

export default function CheckinPage() {
  const { address: walletAddress } = useAccount();
  const { user } = useFarcasterAuth();
  const { toast } = useToast();
  
  const fid = user?.fid?.toString();
  const username = user?.username;
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState(500);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError('Konum erişimi reddedildi. Lütfen tarayıcı izinlerini kontrol edin.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setLocationError('Tarayıcınız konum özelliğini desteklemiyor.');
    }
  }, []);

  // Fetch nearby POIs
  const { data: nearbyData, isLoading: loadingPOIs, refetch: refetchPOIs } = useQuery({
    queryKey: ['/api/places/nearby', userLocation?.lat, userLocation?.lon, searchRadius],
    queryFn: async () => {
      if (!userLocation) return { pois: [], count: 0 };
      const res = await fetch(`/api/places/nearby?lat=${userLocation.lat}&lon=${userLocation.lon}&radius=${searchRadius}`);
      if (!res.ok) throw new Error('Failed to fetch places');
      return res.json();
    },
    enabled: !!userLocation,
    staleTime: 60000,
  });

  // Fetch user's check-in history
  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['/api/checkins/user', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return { checkins: [], count: 0 };
      const res = await fetch(`/api/checkins/user/${walletAddress}?limit=10`);
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json();
    },
    enabled: !!walletAddress,
  });

  // Fetch user's check-in stats
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['/api/checkins/stats', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      const res = await fetch(`/api/checkins/stats/${walletAddress}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: !!walletAddress,
  });

  // Check-in mutation
  const checkinMutation = useMutation({
    mutationFn: async (poi: POI) => {
      const response = await apiRequest('POST', '/api/checkins', {
        walletAddress,
        farcasterFid: fid,
        farcasterUsername: username,
        osmId: poi.osmId,
        placeName: poi.name,
        placeCategory: poi.category,
        placeSubcategory: poi.subcategory,
        latitude: poi.lat,
        longitude: poi.lon,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Check-in Başarılı!",
        description: `${data.pointsEarned} puan kazandınız!`,
      });
      setShowCheckinDialog(false);
      setSelectedPOI(null);
      queryClient.invalidateQueries({ queryKey: ['/api/checkins/user', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/checkins/stats', walletAddress] });
    },
    onError: (error: any) => {
      toast({
        title: "Check-in Başarısız",
        description: error.message || "Bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    },
  });

  const handleCheckin = (poi: POI) => {
    if (!walletAddress) {
      toast({
        title: "Cüzdan Gerekli",
        description: "Check-in yapmak için cüzdanınızı bağlayın.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPOI(poi);
    setShowCheckinDialog(true);
  };

  const confirmCheckin = () => {
    if (selectedPOI) {
      checkinMutation.mutate(selectedPOI);
    }
  };

  const refreshLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError('Konum alınamadı.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const pois = nearbyData?.pois || [];
  const checkins = historyData?.checkins || [];
  const stats: CheckinStats | null = statsData;

  const getCategoryIcon = (category: string) => {
    const Icon = categoryIcons[category] || MapPin;
    return Icon;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPinned className="w-6 h-6 text-amber-500" />
              Check-in
            </h1>
            <p className="text-gray-400 text-sm mt-1">Mekanları keşfet, check-in yap, puan kazan!</p>
          </div>
        </div>

        {/* Stats Cards */}
        {walletAddress && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-500">
                  {loadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : stats?.totalCheckins || 0}
                </div>
                <div className="text-xs text-gray-400">Check-in</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-500">
                  {loadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : stats?.uniquePlaces || 0}
                </div>
                <div className="text-xs text-gray-400">Mekan</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-500">
                  {loadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : stats?.totalPoints || 0}
                </div>
                <div className="text-xs text-gray-400">Puan</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Location Status */}
        {locationError ? (
          <Card className="bg-red-900/30 border-red-700 mb-6">
            <CardContent className="p-4">
              <p className="text-red-400 text-sm">{locationError}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={refreshLocation} data-testid="button-refresh-location">
                <Navigation className="w-4 h-4 mr-2" />
                Tekrar Dene
              </Button>
            </CardContent>
          </Card>
        ) : !userLocation ? (
          <Card className="bg-gray-800/50 border-gray-700 mb-6">
            <CardContent className="p-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-gray-400">Konumunuz alınıyor...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Navigation className="w-4 h-4 text-green-500" />
              <span>Konumunuz alındı</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={searchRadius}
                onChange={(e) => setSearchRadius(Number(e.target.value))}
                className="bg-gray-800 border-gray-700 text-white text-sm rounded-lg px-3 py-1.5"
                data-testid="select-radius"
              >
                <option value={200}>200m</option>
                <option value={500}>500m</option>
                <option value={1000}>1km</option>
                <option value={2000}>2km</option>
              </select>
              <Button variant="outline" size="sm" onClick={refreshLocation} data-testid="button-refresh-location-2">
                <Navigation className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Nearby Places */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-500" />
            Yakındaki Mekanlar ({pois.length})
          </h2>
          
          {loadingPOIs ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : pois.length === 0 ? (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6 text-center text-gray-400">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Yakında mekan bulunamadı.</p>
                <p className="text-sm mt-1">Yarıçapı artırmayı deneyin.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pois.map((poi: POI) => {
                const Icon = getCategoryIcon(poi.category);
                const colorClass = categoryColors[poi.category] || 'bg-gray-500';
                
                return (
                  <Card key={poi.osmId} className="bg-gray-800/50 border-gray-700 hover:border-amber-500/50 transition-colors" data-testid={`card-poi-${poi.osmId}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg ${colorClass}`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white truncate">{poi.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {poi.subcategory}
                              </Badge>
                              {poi.cuisine && (
                                <span className="text-xs text-gray-400">{poi.cuisine}</span>
                              )}
                            </div>
                            {poi.address && (
                              <p className="text-xs text-gray-500 mt-1 truncate">{poi.address}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-black ml-3 shrink-0"
                          onClick={() => handleCheckin(poi)}
                          disabled={!walletAddress}
                          data-testid={`button-checkin-${poi.osmId}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Check-in
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Check-ins */}
        {walletAddress && checkins.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-amber-500" />
              Son Check-inler
            </h2>
            <div className="space-y-2">
              {checkins.slice(0, 5).map((checkin: Checkin) => (
                <Card key={checkin.id} className="bg-gray-800/30 border-gray-700/50" data-testid={`card-checkin-${checkin.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{checkin.place_name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(checkin.created_at).toLocaleDateString('tr-TR')}
                        </p>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400">
                        +{checkin.points_earned} puan
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Check-in Confirmation Dialog */}
        <Dialog open={showCheckinDialog} onOpenChange={setShowCheckinDialog}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-amber-500" />
                Check-in Onayla
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Bu mekana check-in yapmak üzeresiniz.
              </DialogDescription>
            </DialogHeader>
            
            {selectedPOI && (
              <div className="py-4">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg">{selectedPOI.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">{selectedPOI.subcategory}</Badge>
                      <Badge className="bg-amber-500/20 text-amber-400">+10 puan</Badge>
                    </div>
                    {selectedPOI.address && (
                      <p className="text-sm text-gray-400 mt-2">{selectedPOI.address}</p>
                    )}
                  </CardContent>
                </Card>
                
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCheckinDialog(false)}
                    data-testid="button-cancel-checkin"
                  >
                    İptal
                  </Button>
                  <Button
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
                    onClick={confirmCheckin}
                    disabled={checkinMutation.isPending}
                    data-testid="button-confirm-checkin"
                  >
                    {checkinMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Check-in Yap
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
