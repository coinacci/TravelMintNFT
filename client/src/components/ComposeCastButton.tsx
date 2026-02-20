import { Button } from "@/components/ui/button";
import { Share2, Trophy, Camera, Target } from "lucide-react";
import sdk from "@farcaster/frame-sdk";
import { useToast } from "@/hooks/use-toast";

interface ComposeCastButtonProps {
  type: 'quest' | 'mint' | 'leaderboard' | 'nft' | 'badge' | 'general';
  questName?: string;
  questPoints?: number;
  nftName?: string;
  nftLocation?: string;
  nftImageUrl?: string;
  nftTokenId?: string;
  leaderboardPosition?: number;
  totalPoints?: number;
  badgeName?: string;
  badgeCategory?: string;
  customText?: string;
  embeds?: string[];
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  className?: string;
}

export default function ComposeCastButton({
  type,
  questName,
  questPoints,
  nftName,
  nftLocation,
  nftImageUrl,
  nftTokenId,
  leaderboardPosition,
  totalPoints,
  badgeName,
  badgeCategory,
  customText,
  embeds = [],
  variant = "default",
  size = "default",
  disabled = false,
  className
}: ComposeCastButtonProps) {
  const { toast } = useToast();

  const generateCastText = () => {
    if (customText) return customText;

    switch (type) {
      case 'quest':
        return `🎯 Just completed "${questName}" quest on TravelMint and earned ${questPoints} points! Building my travel NFT collection on Base blockchain 🗺️✨`;
      
      case 'mint':
        return `📸 Just minted a new travel NFT "${nftName}" on TravelMint! Creating memories on Base blockchain 🌍⛓️`;
      
      case 'nft':
        return `🖼️ My travel NFT "${nftName}" from ${nftLocation} on TravelMint! Collecting memories on Base 🌍✨`;
      
      case 'leaderboard':
        return `🏆 Ranked ${leaderboardPosition}th on TravelMint leaderboard with ${totalPoints} points! Collecting travel memories on Base blockchain 🎖️`;
      
      case 'badge':
        return `🏅 Just earned the "${badgeName}" badge on TravelMint! ${badgeCategory === 'Event Badges' ? '🎪' : '🏆'} Collecting travel achievements on Base ✨`;
      
      case 'general':
      default:
        return `🗺️ Exploring TravelMint - the travel photo NFT marketplace on Base! Turn your travel memories into NFTs ✨`;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'quest':
        return <Target className="h-4 w-4" />;
      case 'mint':
        return <Camera className="h-4 w-4" />;
      case 'nft':
        return <Share2 className="h-4 w-4" />;
      case 'leaderboard':
        return <Trophy className="h-4 w-4" />;
      case 'badge':
        return <Trophy className="h-4 w-4" />;
      default:
        return <Share2 className="h-4 w-4" />;
    }
  };

  const getButtonText = () => {
    switch (type) {
      case 'quest':
        return 'Share Achievement';
      case 'mint':
        return 'Share NFT';
      case 'nft':
        return 'Share NFT';
      case 'leaderboard':
        return 'Share Position';
      case 'badge':
        return 'Share Badge';
      default:
        return 'Share';
    }
  };

  const handleComposeCast = async () => {
    try {
      const castText = generateCastText();
      let castEmbeds: string[] = [];
      
      if (type === 'nft') {
        const frameUrl = 'https://farcaster.xyz/miniapps/Ie0PvztUB40n/travelmint';
        castEmbeds = [frameUrl];
      } else if (type === 'badge') {
        castEmbeds = ['https://farcaster.xyz/miniapps/Ie0PvztUB40n/travelmint'];
      } else if (embeds.length > 0) {
        castEmbeds = embeds;
      } else {
        castEmbeds = [typeof window !== 'undefined' ? window.location.origin : 'https://travelnft.replit.app'];
      }

      const result = await sdk.actions.composeCast({
        text: castText,
        embeds: castEmbeds.slice(0, 2) as [string] | [string, string] | [],
      });

      if (result) {
        toast({
          title: "Cast composed!",
          description: "Your achievement has been shared to Farcaster.",
        });
      }
    } catch (error) {
      console.error('Failed to compose cast:', error);
      toast({
        title: "Failed to share",
        description: "Could not open cast composer. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      onClick={handleComposeCast}
      variant={variant}
      size={size}
      disabled={disabled}
      className={`gap-2 ${className || ''}`}
      data-testid={`button-compose-cast-${type}`}
    >
      {getIcon()}
      {size !== "icon" && getButtonText()}
    </Button>
  );
}