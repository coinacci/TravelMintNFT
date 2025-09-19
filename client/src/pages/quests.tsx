import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { Target, Gift, Calendar, Trophy, Flame, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import sdk from "@farcaster/frame-sdk";
import { getQuestDay } from "@shared/schema";
import ComposeCastButton from "@/components/ComposeCastButton";
import { useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from "wagmi";
import { parseEther } from "viem";

// Contract configuration
const NFT_CONTRACT_ADDRESS = "0x8c12C9ebF7db0a6370361ce9225e3b77D22A558f" as const;

// ABI for claimBaseReward function
const QUEST_ABI = [
  {
    "inputs": [],
    "name": "claimBaseReward",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

// Helper function to convert fixed-point values (stored as integers * 100) to display format
const pointsToDisplay = (points: number): string => {
  return (points / 100).toFixed(2);
};

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

  // Smart contract interactions for Base transaction quest
  const { data: claimHash, error: claimError, isPending: isClaimPending, sendTransaction } = useSendTransaction();
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } = useWaitForTransactionReceipt({ hash: claimHash });
  const queryClient = useQueryClient();
  
  // Get Farcaster user context
  useEffect(() => {
    const getFarcasterContext = async () => {
      try {
        if (typeof window !== 'undefined' && sdk) {
          try {
            const context = await Promise.resolve(sdk.context);
            if (context?.user) {
              setFarcasterUser({
                fid: context.user.fid,
                username: context.user.username,
                displayName: context.user.displayName,
                pfpUrl: context.user.pfpUrl
              });
            }
          } catch (contextError) {
            console.log('No Farcaster context available');
          }
        }
      } catch (error) {
        console.log('No Farcaster context available');
      }
    };
    
    getFarcasterContext();
  }, []);

  // Fetch user stats
  const { data: userStats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['/api/user-stats', farcasterUser?.fid ? String(farcasterUser.fid) : null],
    enabled: !!farcasterUser?.fid,
  });

  // Fetch today's completed quests
  const { data: todayQuests = [] } = useQuery<QuestCompletion[]>({
    queryKey: ['/api/quest-completions', farcasterUser?.fid ? String(farcasterUser.fid) : null, getQuestDay()],
    enabled: !!farcasterUser?.fid,
  });

  // Check if user holds NFTs (holder status) - simplified to current connected wallet only
  const { data: holderStatus } = useQuery<{ isHolder: boolean; nftCount: number }>({
    queryKey: ['/api/holder-status', address],
    enabled: !!address,
  });

  // Daily check-in mutation
  const checkInMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quest-claim', {
      farcasterFid: String(farcasterUser.fid),
      questType: 'daily_checkin',
      farcasterUsername: farcasterUser.username
    }),
    onSuccess: () => {
      toast({
        title: "Daily check-in complete! 🎉",
        description: "+1.00 points earned"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats', String(farcasterUser.fid)] });
      queryClient.invalidateQueries({ queryKey: ['/api/quest-completions', String(farcasterUser.fid), getQuestDay()] });
    },
    onError: (error) => {
      toast({
        title: "Failed to claim daily check-in",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  });

  // Holder bonus mutation - simplified to current connected wallet only
  const holderBonusMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quest-claim', {
      farcasterFid: String(farcasterUser.fid),
      questType: 'holder_bonus',
      walletAddress: address,
      farcasterUsername: farcasterUser.username
    }),
    onSuccess: () => {
      const nftCount = holderStatus?.nftCount || 1;
      toast({
        title: "Holder bonus claimed! 🏆",
        description: `+${nftCount}.00 point${nftCount > 1 ? 's' : ''} earned (${nftCount} NFT${nftCount > 1 ? 's' : ''})`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats', String(farcasterUser.fid)] });
      queryClient.invalidateQueries({ queryKey: ['/api/quest-completions', String(farcasterUser.fid), getQuestDay()] });
      queryClient.invalidateQueries({ queryKey: ['/api/holder-status', address] });
    },
    onError: (error) => {
      toast({
        title: "Failed to claim holder bonus",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  });

  // Streak bonus mutation
  const streakBonusMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quest-claim', {
      farcasterFid: String(farcasterUser.fid),
      questType: 'streak_bonus',
      farcasterUsername: farcasterUser.username
    }),
    onSuccess: () => {
      toast({
        title: "Streak bonus claimed! 🔥",
        description: "+7.00 points earned for 7-day streak!"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats', String(farcasterUser.fid)] });
      queryClient.invalidateQueries({ queryKey: ['/api/quest-completions', String(farcasterUser.fid), getQuestDay()] });
    },
    onError: (error) => {
      toast({
        title: "Failed to claim streak bonus",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  });

  // Handle successful Base claim transaction
  useEffect(() => {
    if (isClaimConfirmed && claimHash) {
      // Transaction confirmed, now claim quest rewards via API
      const claimQuestReward = async () => {
        try {
          await apiRequest('POST', '/api/quest-claim', {
            farcasterFid: String(farcasterUser.fid),
            questType: 'base_transaction',
            walletAddress: address,
            farcasterUsername: farcasterUser.username
          });

          toast({
            title: "Hello TravelMint! ⚡",
            description: "+0.25 points earned for Base transaction!"
          });
          
          queryClient.invalidateQueries({ queryKey: ['/api/user-stats', String(farcasterUser.fid)] });
          queryClient.invalidateQueries({ queryKey: ['/api/quest-completions', String(farcasterUser.fid), getQuestDay()] });
        } catch (error) {
          toast({
            title: "Quest claiming failed",
            description: "Transaction successful but points not awarded. Please try again.",
            variant: "destructive"
          });
        }
      };

      claimQuestReward();
    }
  }, [isClaimConfirmed, claimHash, farcasterUser, address, toast, queryClient]);

  // Handle claim transaction errors
  useEffect(() => {
    if (claimError) {
      toast({
        title: "Transaction Failed",
        description: claimError.message.includes('User rejected') 
          ? "Transaction cancelled by user"
          : "Failed to complete Base transaction",
        variant: "destructive"
      });
    }
  }, [claimError, toast]);


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

  const today = getQuestDay();
  const hasCheckedInToday = todayQuests.some(q => q.questType === 'daily_checkin');
  const hasClaimedHolderBonus = todayQuests.some(q => q.questType === 'holder_bonus');
  const hasClaimedBaseTransaction = todayQuests.some(q => q.questType === 'base_transaction');
  const canClaimStreakBonus = userStats && userStats.currentStreak >= 7 && 
    (!userStats.lastStreakClaim || getQuestDay(new Date(userStats.lastStreakClaim)) !== today);


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

      {/* Farcaster Connection Banner */}
      {!farcasterUser && (
        <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <div className="flex items-center space-x-2 text-orange-600 dark:text-orange-400">
            <Target className="h-5 w-5" />
            <p className="font-medium">Connect via Farcaster to claim quest rewards</p>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-2xl font-bold" data-testid="total-points">{pointsToDisplay(userStats?.totalPoints || 0)}</p>
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
                  {pointsToDisplay(todayQuests.reduce((sum, q) => sum + q.pointsEarned, 0))}
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
              onClick={() => farcasterUser && checkInMutation.mutate()}
              disabled={!farcasterUser || hasCheckedInToday || checkInMutation.isPending}
              className="w-full mb-3"
              data-testid="button-daily-checkin"
            >
              {!farcasterUser ? "Connect via Farcaster First"
               : hasCheckedInToday ? "✓ Completed Today" 
               : "Claim Check-in"}
            </Button>
            
            {/* Share button - temporarily hidden */}
            {false && hasCheckedInToday && (
              <ComposeCastButton
                type="quest"
                questName="Daily Check-in"
                questPoints={1.00}
                variant="outline"
                size="sm"
                className="w-full"
              />
            )}
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
                  <CardDescription>Earn 1 point per NFT owned</CardDescription>
                </div>
              </div>
              <Badge variant={hasClaimedHolderBonus ? "secondary" : "default"}>
                +{holderStatus?.nftCount || 0}.00 Point{((holderStatus?.nftCount || 0) !== 1) ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => farcasterUser && holderBonusMutation.mutate()}
              disabled={!farcasterUser || !address || !holderStatus?.isHolder || hasClaimedHolderBonus || holderBonusMutation.isPending}
              className="w-full mb-3"
              data-testid="button-holder-bonus"
            >
              {!farcasterUser ? "Connect via Farcaster First"
               : !address ? "Connect Wallet First" 
               : !holderStatus?.isHolder ? "No NFTs Found"
               : hasClaimedHolderBonus ? "✓ Completed Today"
               : `Claim +${holderStatus?.nftCount || 0}.00 Point${((holderStatus?.nftCount || 0) !== 1) ? 's' : ''}`}
            </Button>
            
            {/* Share button - temporarily hidden */}
            {false && hasClaimedHolderBonus && holderStatus?.isHolder && (
              <ComposeCastButton
                type="quest"
                questName="Holder Bonus"
                questPoints={holderStatus?.nftCount || 1}
                variant="outline"
                size="sm"
                className="w-full"
              />
            )}
          </CardContent>
        </Card>

        {/* Base Network Transaction */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="h-6 w-6 text-blue-600" />
                <div>
                  <CardTitle>Hello TravelMint</CardTitle>
                  <CardDescription>Onchain Tx tasks</CardDescription>
                </div>
              </div>
              <Badge variant={hasClaimedBaseTransaction ? "secondary" : "default"}>
                +0.25 Points
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => farcasterUser && sendTransaction({
                to: "0x000000000000000000000000000000000000dEaD", // Burn address 
                value: parseEther('0') // No ETH transfer, only gas fee
              })}
              disabled={!farcasterUser || !address || hasClaimedBaseTransaction || isClaimPending || isClaimConfirming}
              className="w-full mb-3"
              data-testid="button-base-transaction"
            >
              {!farcasterUser ? "Connect via Farcaster First"
               : !address ? "Connect Wallet First" 
               : hasClaimedBaseTransaction ? "✓ Completed Today"
               : "Claim Base Transaction Bonus"}
            </Button>
            
            {/* Share button - only show if quest completed today */}
            {/* Share button - temporarily hidden */}
            {false && hasClaimedBaseTransaction && (
              <ComposeCastButton
                type="quest"
                questName="Hello TravelMint"
                questPoints={0.25}
                variant="outline"
                size="sm"
                className="w-full"
              />
            )}
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
                onClick={() => farcasterUser && streakBonusMutation.mutate()}
                disabled={!farcasterUser || !canClaimStreakBonus || streakBonusMutation.isPending}
                className="w-full mb-3"
                data-testid="button-streak-bonus"
              >
                {!farcasterUser ? "Connect via Farcaster First"
                 : !canClaimStreakBonus ? `Need ${7 - (userStats?.currentStreak || 0)} more days` 
                 : "Claim Streak Bonus"}
              </Button>
              
              {/* Share button - temporarily hidden
              {false && userStats && typeof userStats.currentStreak === 'number' && userStats.currentStreak >= 7 && (
                <ComposeCastButton
                  type="quest"
                  questName="7-Day Streak Bonus"
                  questPoints={7.00}
                  variant="outline"
                  size="sm"
                  className="w-full"
                />
              )}
              */}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}