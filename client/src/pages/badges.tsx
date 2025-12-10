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
import { Lock, CheckCircle } from "lucide-react";

import firstMintBadge from "@assets/stock_images/golden_achievement_b_c5e2fcee.jpg";
import explorerBadge from "@assets/stock_images/explorer_telescope_d_8ac92a5e.jpg";
import globetrotterBadge from "@assets/stock_images/travel_world_globe_b_abba2058.jpg";
import nftMasterBadge from "@assets/stock_images/rocket_launch_succes_9141f9fe.jpg";
import multiCountryBadge from "@assets/stock_images/travel_world_globe_b_1499489a.jpg";
import worldTravelerBadge from "@assets/stock_images/airplane_travel_jour_a59043ab.jpg";
import globalCitizenBadge from "@assets/stock_images/travel_world_globe_b_fd9b4de6.jpg";
import multiCityBadge from "@assets/stock_images/city_skyline_travel__c7d7ed0f.jpg";
import cityExplorerBadge from "@assets/stock_images/city_skyline_travel__6f73bbb6.jpg";
import urbanNomadBadge from "@assets/stock_images/city_skyline_travel__da668483.jpg";
import firstTipperBadge from "@assets/stock_images/heart_social_charity_79634b76.jpg";
import generousBadge from "@assets/stock_images/heart_social_charity_367ead98.jpg";
import popularBadge from "@assets/stock_images/star_celebrity_popul_e85201fe.jpg";
import superstarBadge from "@assets/stock_images/star_celebrity_popul_a8c409fe.jpg";
import firstLikeBadge from "@assets/stock_images/star_celebrity_popul_e85201fe.jpg";
import likedBadge from "@assets/stock_images/star_celebrity_popul_a8c409fe.jpg";
import tipReceiverBadge from "@assets/stock_images/golden_coin_money_ti_123d74f6.jpg";
import tipCollectorBadge from "@assets/stock_images/golden_coin_money_ti_c7130813.jpg";
import tipMagnetBadge from "@assets/stock_images/golden_coin_money_ti_1400937e.jpg";

interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  category: "mint" | "location" | "social";
  imageUrl: string;
  requirement: number;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    code: "first_mint",
    name: "First Mint",
    description: "Mint your first NFT",
    category: "mint",
    imageUrl: firstMintBadge,
    requirement: 1,
  },
  {
    code: "explorer",
    name: "Explorer",
    description: "Mint 5 NFTs",
    category: "mint",
    imageUrl: explorerBadge,
    requirement: 5,
  },
  {
    code: "globetrotter",
    name: "Globetrotter",
    description: "Mint 10 NFTs",
    category: "mint",
    imageUrl: globetrotterBadge,
    requirement: 10,
  },
  {
    code: "nft_master",
    name: "NFT Master",
    description: "Mint 25 NFTs",
    category: "mint",
    imageUrl: nftMasterBadge,
    requirement: 25,
  },
  {
    code: "multi_country",
    name: "Multi-Country",
    description: "Mint NFTs from 3 different countries",
    category: "location",
    imageUrl: multiCountryBadge,
    requirement: 3,
  },
  {
    code: "world_traveler",
    name: "World Traveler",
    description: "Mint NFTs from 5 different countries",
    category: "location",
    imageUrl: worldTravelerBadge,
    requirement: 5,
  },
  {
    code: "global_citizen",
    name: "Global Citizen",
    description: "Mint NFTs from 10 different countries",
    category: "location",
    imageUrl: globalCitizenBadge,
    requirement: 10,
  },
  {
    code: "multi_city",
    name: "Multi-City",
    description: "Mint NFTs from 3 different cities",
    category: "location",
    imageUrl: multiCityBadge,
    requirement: 3,
  },
  {
    code: "city_explorer",
    name: "City Explorer",
    description: "Mint NFTs from 5 different cities",
    category: "location",
    imageUrl: cityExplorerBadge,
    requirement: 5,
  },
  {
    code: "urban_nomad",
    name: "Urban Nomad",
    description: "Mint NFTs from 10 different cities",
    category: "location",
    imageUrl: urbanNomadBadge,
    requirement: 10,
  },
  {
    code: "first_tipper",
    name: "First Tipper",
    description: "Send your first tip to a creator",
    category: "social",
    imageUrl: firstTipperBadge,
    requirement: 1,
  },
  {
    code: "generous",
    name: "Generous",
    description: "Tip 5 different creators",
    category: "social",
    imageUrl: generousBadge,
    requirement: 5,
  },
  {
    code: "first_like",
    name: "First Like",
    description: "Receive 1 like on your NFTs",
    category: "social",
    imageUrl: firstLikeBadge,
    requirement: 1,
  },
  {
    code: "liked",
    name: "Liked",
    description: "Receive 5 likes on your NFTs",
    category: "social",
    imageUrl: likedBadge,
    requirement: 5,
  },
  {
    code: "popular",
    name: "Popular",
    description: "Receive 10 likes on your NFTs",
    category: "social",
    imageUrl: popularBadge,
    requirement: 10,
  },
  {
    code: "superstar",
    name: "Superstar",
    description: "Receive 50 likes on your NFTs",
    category: "social",
    imageUrl: superstarBadge,
    requirement: 50,
  },
  {
    code: "tip_receiver",
    name: "Tip Receiver",
    description: "Receive 1 tip on your NFTs",
    category: "social",
    imageUrl: tipReceiverBadge,
    requirement: 1,
  },
  {
    code: "tip_collector",
    name: "Tip Collector",
    description: "Receive 5 tips on your NFTs",
    category: "social",
    imageUrl: tipCollectorBadge,
    requirement: 5,
  },
  {
    code: "tip_magnet",
    name: "Tip Magnet",
    description: "Receive 10 tips on your NFTs",
    category: "social",
    imageUrl: tipMagnetBadge,
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
  const { isAuthenticated, user } = useFarcasterAuth();
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
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {badges.map((badge) => {
                const isEarned = earnedBadgeCodes.has(badge.code);
                
                return (
                  <Card 
                    key={badge.code}
                    className={`bg-gray-900 border-gray-800 overflow-hidden transition-all cursor-pointer hover:scale-105 ${
                      isEarned ? "ring-2 ring-primary" : ""
                    }`}
                    data-testid={`badge-card-${badge.code}`}
                    onClick={() => setSelectedBadge(badge)}
                  >
                    <CardContent className="p-3">
                      {isLoading ? (
                        <Skeleton className="w-full aspect-square rounded-lg mb-2" />
                      ) : (
                        <div className="relative">
                          <img
                            src={badge.imageUrl}
                            alt={badge.name}
                            className={`w-full aspect-square object-cover rounded-lg mb-2 ${
                              isEarned ? "" : "grayscale opacity-50"
                            }`}
                          />
                          {isEarned && (
                            <div className="absolute top-1 right-1 bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">
                              Earned
                            </div>
                          )}
                        </div>
                      )}
                      
                      <h3 className={`font-semibold text-sm text-center ${isEarned ? "text-white" : "text-gray-500"}`}>
                        {badge.name}
                      </h3>
                    </CardContent>
                  </Card>
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
                  <img
                    src={selectedBadge.imageUrl}
                    alt={selectedBadge.name}
                    className={`w-48 h-48 object-cover rounded-xl ${
                      isSelectedEarned ? "" : "grayscale opacity-50"
                    }`}
                  />
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
