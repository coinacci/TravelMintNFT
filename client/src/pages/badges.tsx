import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFarcasterAuth } from "@/hooks/use-farcaster-auth";
import { useAccount } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Lock, 
  CheckCircle,
  Sparkles,
  Compass,
  Globe,
  Crown,
  MapPin,
  Plane,
  Earth,
  Building2,
  Map,
  Landmark,
  Heart,
  Gift,
  ThumbsUp,
  Star,
  Trophy,
  Coins,
  Wallet,
  TrendingUp,
  type LucideIcon
} from "lucide-react";

interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  category: "mint" | "location" | "social";
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
  requirement: number;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    code: "first_mint",
    name: "First Mint",
    description: "Mint your first NFT",
    category: "mint",
    icon: Sparkles,
    bgColor: "bg-gradient-to-br from-amber-400 to-orange-500",
    iconColor: "text-white",
    requirement: 1,
  },
  {
    code: "explorer",
    name: "Explorer",
    description: "Mint 5 NFTs",
    category: "mint",
    icon: Compass,
    bgColor: "bg-gradient-to-br from-emerald-400 to-teal-500",
    iconColor: "text-white",
    requirement: 5,
  },
  {
    code: "globetrotter",
    name: "Globetrotter",
    description: "Mint 10 NFTs",
    category: "mint",
    icon: Globe,
    bgColor: "bg-gradient-to-br from-blue-400 to-indigo-500",
    iconColor: "text-white",
    requirement: 10,
  },
  {
    code: "nft_master",
    name: "NFT Master",
    description: "Mint 25 NFTs",
    category: "mint",
    icon: Crown,
    bgColor: "bg-gradient-to-br from-purple-400 to-pink-500",
    iconColor: "text-white",
    requirement: 25,
  },
  {
    code: "multi_country",
    name: "Multi-Country",
    description: "Mint NFTs from 3 different countries",
    category: "location",
    icon: MapPin,
    bgColor: "bg-gradient-to-br from-rose-400 to-red-500",
    iconColor: "text-white",
    requirement: 3,
  },
  {
    code: "world_traveler",
    name: "World Traveler",
    description: "Mint NFTs from 5 different countries",
    category: "location",
    icon: Plane,
    bgColor: "bg-gradient-to-br from-sky-400 to-blue-500",
    iconColor: "text-white",
    requirement: 5,
  },
  {
    code: "global_citizen",
    name: "Global Citizen",
    description: "Mint NFTs from 10 different countries",
    category: "location",
    icon: Earth,
    bgColor: "bg-gradient-to-br from-green-400 to-emerald-500",
    iconColor: "text-white",
    requirement: 10,
  },
  {
    code: "multi_city",
    name: "Multi-City",
    description: "Mint NFTs from 3 different cities",
    category: "location",
    icon: Building2,
    bgColor: "bg-gradient-to-br from-slate-400 to-gray-500",
    iconColor: "text-white",
    requirement: 3,
  },
  {
    code: "city_explorer",
    name: "City Explorer",
    description: "Mint NFTs from 5 different cities",
    category: "location",
    icon: Map,
    bgColor: "bg-gradient-to-br from-cyan-400 to-teal-500",
    iconColor: "text-white",
    requirement: 5,
  },
  {
    code: "urban_nomad",
    name: "Urban Nomad",
    description: "Mint NFTs from 10 different cities",
    category: "location",
    icon: Landmark,
    bgColor: "bg-gradient-to-br from-violet-400 to-purple-500",
    iconColor: "text-white",
    requirement: 10,
  },
  {
    code: "first_tipper",
    name: "First Tipper",
    description: "Send your first tip to a creator",
    category: "social",
    icon: Heart,
    bgColor: "bg-gradient-to-br from-pink-400 to-rose-500",
    iconColor: "text-white",
    requirement: 1,
  },
  {
    code: "generous",
    name: "Generous",
    description: "Tip 5 different creators",
    category: "social",
    icon: Gift,
    bgColor: "bg-gradient-to-br from-fuchsia-400 to-pink-500",
    iconColor: "text-white",
    requirement: 5,
  },
  {
    code: "first_like",
    name: "First Like",
    description: "Receive 1 like on your NFTs",
    category: "social",
    icon: ThumbsUp,
    bgColor: "bg-gradient-to-br from-blue-400 to-sky-500",
    iconColor: "text-white",
    requirement: 1,
  },
  {
    code: "liked",
    name: "Liked",
    description: "Receive 5 likes on your NFTs",
    category: "social",
    icon: Star,
    bgColor: "bg-gradient-to-br from-yellow-400 to-amber-500",
    iconColor: "text-white",
    requirement: 5,
  },
  {
    code: "popular",
    name: "Popular",
    description: "Receive 10 likes on your NFTs",
    category: "social",
    icon: Trophy,
    bgColor: "bg-gradient-to-br from-orange-400 to-red-500",
    iconColor: "text-white",
    requirement: 10,
  },
  {
    code: "superstar",
    name: "Superstar",
    description: "Receive 50 likes on your NFTs",
    category: "social",
    icon: Crown,
    bgColor: "bg-gradient-to-br from-amber-300 to-yellow-500",
    iconColor: "text-white",
    requirement: 50,
  },
  {
    code: "tip_receiver",
    name: "Tip Receiver",
    description: "Receive 1 tip on your NFTs",
    category: "social",
    icon: Coins,
    bgColor: "bg-gradient-to-br from-lime-400 to-green-500",
    iconColor: "text-white",
    requirement: 1,
  },
  {
    code: "tip_collector",
    name: "Tip Collector",
    description: "Receive 5 tips on your NFTs",
    category: "social",
    icon: Wallet,
    bgColor: "bg-gradient-to-br from-emerald-400 to-green-500",
    iconColor: "text-white",
    requirement: 5,
  },
  {
    code: "tip_magnet",
    name: "Tip Magnet",
    description: "Receive 10 tips on your NFTs",
    category: "social",
    icon: TrendingUp,
    bgColor: "bg-gradient-to-br from-teal-400 to-cyan-500",
    iconColor: "text-white",
    requirement: 10,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  mint: "Mint Badges",
  location: "Location Badges",
  social: "Social Badges",
};

const CATEGORY_ORDER = ["mint", "location", "social"];

interface UserBadgeData {
  earnedBadges: string[];
}

export default function Badges() {
  const { user } = useFarcasterAuth();
  const { address } = useAccount();
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);
  
  const userIdentifier = user?.fid || address;
  
  const { data: userBadgeData, isLoading } = useQuery<UserBadgeData>({
    queryKey: ["/api/badges/user", userIdentifier],
    enabled: !!userIdentifier,
  });
  
  const earnedBadgeCodes = new Set(userBadgeData?.earnedBadges || []);
  
  const badgesByCategory = CATEGORY_ORDER.map(category => ({
    category,
    label: CATEGORY_LABELS[category],
    badges: BADGE_DEFINITIONS.filter(b => b.category === category),
  }));
  
  const isSelectedEarned = selectedBadge ? earnedBadgeCodes.has(selectedBadge.code) : false;

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Badges</h1>
          <p className="text-gray-400 text-sm">
            Earn badges by minting NFTs, traveling, and engaging with the community
          </p>
        </div>
        
        {!userIdentifier && (
          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardContent className="p-4 text-center">
              <p className="text-gray-400">Connect your wallet or sign in with Farcaster to track your badges</p>
            </CardContent>
          </Card>
        )}
        
        {badgesByCategory.map(({ category, label, badges }) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-primary">{label}</h2>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {badges.map((badge) => {
                const isEarned = earnedBadgeCodes.has(badge.code);
                const IconComponent = badge.icon;
                
                return (
                  <div 
                    key={badge.code}
                    className="flex flex-col items-center cursor-pointer transition-transform hover:scale-105"
                    data-testid={`badge-card-${badge.code}`}
                    onClick={() => setSelectedBadge(badge)}
                  >
                    <div 
                      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shadow-lg ${
                        isEarned 
                          ? badge.bgColor 
                          : "bg-gray-700"
                      } ${isEarned ? "" : "opacity-40"}`}
                    >
                      {isLoading ? (
                        <Skeleton className="w-8 h-8 rounded-full" />
                      ) : (
                        <IconComponent className={`w-8 h-8 sm:w-10 sm:h-10 ${isEarned ? badge.iconColor : "text-gray-400"}`} />
                      )}
                    </div>
                    
                    {isEarned && (
                      <div className="absolute -top-1 -right-1">
                        <CheckCircle className="w-5 h-5 text-green-500 fill-green-500" />
                      </div>
                    )}
                    
                    <span className={`mt-2 text-xs text-center font-medium ${isEarned ? "text-white" : "text-gray-500"}`}>
                      {badge.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        <div className="text-center text-gray-500 text-sm mt-8">
          <p>
            {earnedBadgeCodes.size} / {BADGE_DEFINITIONS.length} badges earned
          </p>
        </div>
      </div>
      
      <Dialog open={!!selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
          {selectedBadge && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {isSelectedEarned ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-500" />
                  )}
                  {selectedBadge.name}
                </DialogTitle>
              </DialogHeader>
              
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative">
                  <div 
                    className={`w-32 h-32 rounded-3xl flex items-center justify-center shadow-xl ${
                      isSelectedEarned 
                        ? selectedBadge.bgColor 
                        : "bg-gray-700"
                    } ${isSelectedEarned ? "" : "opacity-40"}`}
                  >
                    <selectedBadge.icon className={`w-16 h-16 ${isSelectedEarned ? selectedBadge.iconColor : "text-gray-400"}`} />
                  </div>
                  {isSelectedEarned && (
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                      Earned!
                    </div>
                  )}
                </div>
                
                <div className="text-center">
                  <p className="text-gray-300 mb-2">{selectedBadge.description}</p>
                  <p className="text-xs text-gray-500">
                    Category: {CATEGORY_LABELS[selectedBadge.category]}
                  </p>
                </div>
                
                {!isSelectedEarned && (
                  <div className="bg-gray-800 rounded-lg px-4 py-2 text-center">
                    <p className="text-sm text-gray-400">
                      Keep going to unlock this badge!
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
