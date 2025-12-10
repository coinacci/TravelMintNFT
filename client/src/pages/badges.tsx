import { useQuery } from "@tanstack/react-query";
import { useFarcasterAuth } from "@/hooks/use-farcaster-auth";
import { useAccount } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import firstMintBadge from "@assets/stock_images/golden_achievement_b_c5e2fcee.jpg";
import explorerBadge from "@assets/stock_images/explorer_telescope_d_8ac92a5e.jpg";
import globetrotterBadge from "@assets/stock_images/travel_world_globe_b_abba2058.jpg";
import nftMasterBadge from "@assets/stock_images/rocket_launch_succes_9141f9fe.jpg";
import multiCountryBadge from "@assets/stock_images/travel_world_globe_b_1499489a.jpg";
import worldTravelerBadge from "@assets/stock_images/airplane_travel_jour_a59043ab.jpg";
import globalCitizenBadge from "@assets/stock_images/travel_world_globe_b_fd9b4de6.jpg";
import firstTipperBadge from "@assets/stock_images/heart_social_charity_79634b76.jpg";
import generousBadge from "@assets/stock_images/heart_social_charity_367ead98.jpg";
import popularBadge from "@assets/stock_images/star_celebrity_popul_e85201fe.jpg";
import superstarBadge from "@assets/stock_images/star_celebrity_popul_a8c409fe.jpg";
import questStarterBadge from "@assets/stock_images/target_quest_mission_51c4079f.jpg";
import questMasterBadge from "@assets/stock_images/target_quest_mission_86d9467f.jpg";

interface BadgeDefinition {
  code: string;
  name: string;
  description: string;
  category: "mint" | "location" | "social" | "quest";
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
    code: "quest_starter",
    name: "Quest Starter",
    description: "Complete your first quest",
    category: "quest",
    imageUrl: questStarterBadge,
    requirement: 1,
  },
  {
    code: "quest_master",
    name: "Quest Master",
    description: "Complete all available quests",
    category: "quest",
    imageUrl: questMasterBadge,
    requirement: 5,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  mint: "Mint Badges",
  location: "Location Badges",
  social: "Social Badges",
  quest: "Quest Badges",
};

const CATEGORY_ORDER = ["mint", "location", "social", "quest"];

interface UserBadgeData {
  earnedBadges: string[];
}

export default function Badges() {
  const { isAuthenticated, user } = useFarcasterAuth();
  const { address } = useAccount();
  
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
                    className={`bg-gray-900 border-gray-800 overflow-hidden transition-all ${
                      isEarned ? "ring-2 ring-primary" : ""
                    }`}
                    data-testid={`badge-card-${badge.code}`}
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
                      
                      <h3 className={`font-semibold text-sm ${isEarned ? "text-white" : "text-gray-500"}`}>
                        {badge.name}
                      </h3>
                      <p className={`text-xs mt-1 ${isEarned ? "text-gray-400" : "text-gray-600"}`}>
                        {badge.description}
                      </p>
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
    </div>
  );
}
