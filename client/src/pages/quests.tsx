import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { Target, Gift, Calendar, Trophy, Flame } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import sdk from "@farcaster/frame-sdk";

interface UserStats {
  farcasterFid: string;
  farcasterUsername: string;
  totalPoints: number;
  currentStreak: number;
  lastCheckIn: string | null;
  lastStreakClaim: string | null;
}

interface QuestCompletion {
  questType: string;
  completionDate: string;
  pointsEarned: number;
}

export default function Quests() {
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  const { address } = useAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get Farcaster user context
  useEffect(() => {
    const getFarcasterContext = async () => {
      try {
        if (typeof window !== 'undefined' && sdk?.context) {
          const context = await Promise.resolve(sdk.context);
          if (context?.user) {
            setFarcasterUser({
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl
            });
          }
        }
      } catch (error) {
        console.log('ℹ️ No Farcaster context in quests');
      }
    };
    
    getFarcasterContext();
  }, []);

  // Fetch user stats
  const { data: userStats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['/api/user-stats', farcasterUser?.fid],
    enabled: !!farcasterUser?.fid,
  });

  // Fetch today's completed quests
  const { data: todayQuests = [] } = useQuery<QuestCompletion[]>({
    queryKey: ['/api/quest-completions', farcasterUser?.fid, new Date().toISOString().split('T')[0]],
    enabled: !!farcasterUser?.fid,
  });

  // Check if user holds NFTs (holder status)
  const { data: holderStatus } = useQuery<{ isHolder: boolean; nftCount: number }>({
    queryKey: ['/api/holder-status', address],
    enabled: !!address,
  });

  // Daily check-in mutation
  const checkInMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quest-claim', {
      farcasterFid: farcasterUser.fid,
      questType: 'daily_checkin',
      farcasterUsername: farcasterUser.username
    }),
    onSuccess: () => {
      toast({
        title: "Daily check-in complete! 🎉",
        description: "+1 point earned"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quest-completions'] });
    }
  });

  // Holder bonus mutation
  const holderBonusMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quest-claim', {
      farcasterFid: farcasterUser.fid,
      questType: 'holder_bonus',
      walletAddress: address,
      farcasterUsername: farcasterUser.username
    }),
    onSuccess: () => {
      toast({
        title: "Holder bonus claimed! 🏆",
        description: "+3 points earned"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quest-completions'] });
    }
  });

  // Streak bonus mutation
  const streakBonusMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quest-claim', {
      farcasterFid: farcasterUser.fid,
      questType: 'streak_bonus',
      farcasterUsername: farcasterUser.username
    }),
    onSuccess: () => {
      toast({
        title: "Streak bonus claimed! 🔥",
        description: "+7 points earned for 7-day streak!"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quest-completions'] });
    }
  });

  if (!farcasterUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Farcaster Only</h1>
          <p className="text-muted-foreground">
            Quest system is only available when accessing through Farcaster.
          </p>
        </div>
      </div>
    );
  }

  if (statsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your quest progress...</p>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const hasCheckedInToday = todayQuests.some(q => q.questType === 'daily_checkin');
  const hasClaimedHolderBonus = todayQuests.some(q => q.questType === 'holder_bonus');
  const canClaimStreakBonus = userStats && userStats.currentStreak >= 7 && 
    (!userStats.lastStreakClaim || new Date(userStats.lastStreakClaim).toISOString().split('T')[0] !== today);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <Target className="h-12 w-12 mx-auto text-primary mb-4" />
        <h1 className="text-3xl font-bold mb-2">Daily Quests</h1>
        <p className="text-muted-foreground">
          Complete daily tasks to earn points and climb the leaderboard!
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-2xl font-bold" data-testid="total-points">{userStats?.totalPoints || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Flame className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Current Streak</p>
                <p className="text-2xl font-bold" data-testid="current-streak">{userStats?.currentStreak || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Gift className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Today's Points</p>
                <p className="text-2xl font-bold" data-testid="today-points">
                  {todayQuests.reduce((sum, q) => sum + q.pointsEarned, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Quests */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Today's Quests</h2>
        
        {/* Daily Check-in */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Calendar className="h-6 w-6 text-blue-500" />
                <div>
                  <CardTitle>Daily Check-in</CardTitle>
                  <CardDescription>Visit TravelMint and claim your daily point</CardDescription>
                </div>
              </div>
              <Badge variant={hasCheckedInToday ? "secondary" : "default"}>
                +1 Point
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => checkInMutation.mutate()}
              disabled={hasCheckedInToday || checkInMutation.isPending}
              className="w-full"
              data-testid="button-daily-checkin"
            >
              {hasCheckedInToday ? "✓ Completed Today" : "Claim Check-in"}
            </Button>
          </CardContent>
        </Card>

        {/* Holder Bonus */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Gift className="h-6 w-6 text-purple-500" />
                <div>
                  <CardTitle>Holder Bonus</CardTitle>
                  <CardDescription>Extra points for NFT holders</CardDescription>
                </div>
              </div>
              <Badge variant={hasClaimedHolderBonus ? "secondary" : "default"}>
                +3 Points
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => holderBonusMutation.mutate()}
              disabled={!address || !holderStatus?.isHolder || hasClaimedHolderBonus || holderBonusMutation.isPending}
              className="w-full"
              data-testid="button-holder-bonus"
            >
              {!address ? "Connect Wallet First" 
               : !holderStatus?.isHolder ? "No NFTs Found"
               : hasClaimedHolderBonus ? "✓ Completed Today"
               : "Claim Holder Bonus"}
            </Button>
          </CardContent>
        </Card>

        {/* 7-Day Streak Bonus */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Flame className="h-6 w-6 text-red-500" />
                <div>
                  <CardTitle>7-Day Streak Bonus</CardTitle>
                  <CardDescription>Claim bonus after 7 consecutive days</CardDescription>
                </div>
              </div>
              <Badge variant={canClaimStreakBonus ? "default" : "secondary"}>
                +7 Points
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Streak Progress</span>
                  <span>{Math.min(userStats?.currentStreak || 0, 7)}/7 days</span>
                </div>
                <Progress 
                  value={(Math.min(userStats?.currentStreak || 0, 7) / 7) * 100} 
                  className="h-2"
                />
              </div>
              <Button
                onClick={() => streakBonusMutation.mutate()}
                disabled={!canClaimStreakBonus || streakBonusMutation.isPending}
                className="w-full"
                data-testid="button-streak-bonus"
              >
                {!canClaimStreakBonus ? `Need ${7 - (userStats?.currentStreak || 0)} more days` : "Claim Streak Bonus"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}