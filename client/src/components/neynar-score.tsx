import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Star, Loader2, RefreshCw, Share2 } from "lucide-react";
import sdk from "@farcaster/frame-sdk";
import { useToast } from "@/hooks/use-toast";

interface NeynarScoreData {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  followerCount: number;
  followingCount: number;
  neynarScore: number;
  activeStatus: string;
  verifiedAddresses: string[];
}

interface NeynarScoreProps {
  fid: string | null;
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return "text-green-400";
  if (score >= 0.6) return "text-blue-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-red-400";
}

function getScoreLabel(score: number): string {
  if (score >= 0.8) return "Excellent";
  if (score >= 0.6) return "Good";
  if (score >= 0.4) return "Fair";
  return "Low";
}

function getScoreBgColor(score: number): string {
  if (score >= 0.8) return "bg-green-500/20";
  if (score >= 0.6) return "bg-blue-500/20";
  if (score >= 0.4) return "bg-yellow-500/20";
  return "bg-red-500/20";
}

function getBarColor(score: number): string {
  if (score >= 0.8) return "bg-green-500";
  if (score >= 0.6) return "bg-blue-500";
  if (score >= 0.4) return "bg-yellow-500";
  return "bg-red-500";
}

export default function NeynarScore({ fid }: NeynarScoreProps) {
  const [hasChecked, setHasChecked] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const { toast } = useToast();

  const { data, isFetching, error, refetch } = useQuery<NeynarScoreData>({
    queryKey: ['/api/neynar/score', fid],
    enabled: false,
    retry: 1,
  });

  useEffect(() => {
    setHasChecked(false);
  }, [fid]);

  if (!fid) {
    return null;
  }

  const handleCheckScore = async () => {
    if (!fid) return;
    setHasChecked(true);
    await refetch();
  };

  const handleShareScore = async () => {
    if (!data) return;
    
    setIsSharing(true);
    try {
      // Check if Farcaster SDK is available
      if (!sdk?.actions?.composeCast) {
        toast({
          title: "Share unavailable",
          description: "Please open in Farcaster to share",
          variant: "destructive",
        });
        return;
      }

      const score = data.neynarScore;
      const label = getScoreLabel(score);
      const appUrl = "https://farcaster.xyz/miniapps/Ie0PvztUB40n/travelmint";
      
      const castText = `My Neynar Score is ${score.toFixed(2)} (${label})! 🎯\n\nCheck your Neynar Score on TravelMint:`;
      
      await sdk.actions.composeCast({
        text: castText,
        embeds: [appUrl],
      });
      
      toast({
        title: "Cast composed!",
        description: "Share your Neynar Score with your followers",
      });
    } catch (error) {
      console.error('Failed to share score:', error);
      toast({
        title: "Share failed",
        description: "Could not open compose window",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  if (!hasChecked) {
    return (
      <Card className="bg-black border-gray-800" data-testid="neynar-score-card">
        <CardContent className="p-4">
          <Button
            onClick={handleCheckScore}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium"
            data-testid="button-check-neynar-score"
          >
            <Shield className="w-4 h-4 mr-2" />
            Check your Neynar Score
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isFetching) {
    return (
      <Card className="bg-black border-gray-800" data-testid="neynar-score-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-2 text-white">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span>Checking your score...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-black border-gray-800" data-testid="neynar-score-card">
        <CardContent className="p-4">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-3">Unable to load score</p>
            <Button
              onClick={handleCheckScore}
              variant="outline"
              size="sm"
              className="border-gray-600 text-white hover:bg-gray-800"
              data-testid="button-retry-neynar-score"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const score = data.neynarScore;
  const scorePercent = Math.round(score * 100);

  return (
    <Card className="bg-black border-gray-800" data-testid="neynar-score-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white text-sm font-medium">
            <Shield className="w-4 h-4 text-purple-400" />
            Neynar Score
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={handleShareScore}
              disabled={isSharing}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-purple-400 hover:text-purple-300 hover:bg-gray-800"
              data-testid="button-share-neynar-score"
            >
              {isSharing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
            </Button>
            <Button
              onClick={handleCheckScore}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
              data-testid="button-refresh-neynar-score"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${getScoreBgColor(score)}`}>
              <span className={`text-lg font-bold ${getScoreColor(score)}`} data-testid="neynar-score-value">
                {score.toFixed(2)}
              </span>
            </div>
            <div>
              <div className={`text-lg font-semibold ${getScoreColor(score)}`} data-testid="neynar-score-label">
                {getScoreLabel(score)}
              </div>
              <div className="text-xs text-gray-400">
                Account Quality Score
              </div>
            </div>
          </div>
          <Star className={`w-5 h-5 ${getScoreColor(score)}`} />
        </div>

        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${getBarColor(score)}`}
            style={{ width: `${scorePercent}%` }}
            data-testid="neynar-score-bar"
          />
        </div>
      </CardContent>
    </Card>
  );
}
