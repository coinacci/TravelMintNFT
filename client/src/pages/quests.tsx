import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { Target, Gift, Calendar, Trophy, Flame, Zap, MessageSquare, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
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
  hasAddedMiniApp: boolean;
  referralCode: string | null;
  referralCount: number;
  unclaimedReferrals: number;
}

interface QuestCompletion {
  questType: string;
  completionDate: string;
  pointsEarned: number;
}

export default function Quests() {
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  const [castUrl, setCastUrl] = useState<string>('');
  const { address } = useAccount();
  const { toast } = useToast();

  // Smart contract interactions for Base transaction quest
  const { data: claimHash, error: claimError, isPending: isClaimPending, sendTransaction } = useSendTransaction();
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } = useWaitForTransactionReceipt({ hash: claimHash });
  const queryClient = useQueryClient();
  
  // Get Farcaster user context with polling for added status
  useEffect(() => {
    const getFarcasterContext = async () => {
      try {
        if (typeof window !== 'undefined' && sdk) {
          try {
            const context = await Promise.resolve(sdk.context);
            if (context?.user) {
              setFarcasterUser((prev: any) => {
                const newUser = {
                  fid: context.user.fid,
                  username: context.user.username,
                  displayName: context.user.displayName,
                  pfpUrl: context.user.pfpUrl,
                  added: context.client?.added || false // Track if app is added
                };
                // Only update if something changed
                if (JSON.stringify(prev) !== JSON.stringify(newUser)) {
                  console.log('🔄 Farcaster context updated:', { added: newUser.added });
                  return newUser;
                }
                return prev;
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
    
    // Initial fetch
    getFarcasterContext();
    
    // Poll for context changes every 3 seconds
    const intervalId = setInterval(getFarcasterContext, 3000);
    
    return () => clearInterval(intervalId);
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

  // Check if user holds NFTs (holder status) - uses all linked wallets + verified addresses
  const { data: holderStatus } = useQuery<{ isHolder: boolean; nftCount: number }>({
    queryKey: ['/api/combined-holder-status', farcasterUser?.fid ? String(farcasterUser.fid) : null],
    enabled: !!farcasterUser?.fid,
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

  // Holder bonus mutation - uses combined multi-wallet NFT count
  const holderBonusMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quest-claim', {
      farcasterFid: String(farcasterUser.fid),
      questType: 'holder_bonus',
      farcasterUsername: farcasterUser.username
    }),
    onSuccess: () => {
      const nftCount = holderStatus?.nftCount || 1;
      const points = nftCount * 0.15;
      toast({
        title: "Holder bonus claimed! 🏆",
        description: `+${points.toFixed(2)} point${points !== 0.15 ? 's' : ''} earned (${nftCount} NFT${nftCount > 1 ? 's' : ''})`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats', String(farcasterUser.fid)] });
      queryClient.invalidateQueries({ queryKey: ['/api/quest-completions', String(farcasterUser.fid), getQuestDay()] });
      queryClient.invalidateQueries({ queryKey: ['/api/combined-holder-status', String(farcasterUser.fid)] });
    },
    onError: (error) => {
      toast({
        title: "Failed to claim holder bonus",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  });

  // Social post quest mutation
  const socialPostMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quest-claim', {
      farcasterFid: String(farcasterUser.fid),
      questType: 'social_post',
      castUrl: castUrl.trim(),
      farcasterUsername: farcasterUser.username
    }),
    onSuccess: () => {
      toast({
        title: "Daily Post completed! 📢",
        description: "+5 points earned for sharing TravelMint!"
      });
      setCastUrl(''); // Clear the input
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats', String(farcasterUser.fid)] });
      queryClient.invalidateQueries({ queryKey: ['/api/quest-completions', String(farcasterUser.fid), getQuestDay()] });
    },
    onError: (error) => {
      toast({
        title: "Failed to claim social post quest",
        description: error?.message || "Please check your cast URL and try again",
        variant: "destructive"
      });
    }
  });

  // Add Mini App quest mutation (one-time)
  const addMiniAppMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quests/complete-add-miniapp', {
      farcasterFid: String(farcasterUser.fid),
      farcasterUsername: farcasterUser.username,
      farcasterPfpUrl: farcasterUser.pfpUrl
    }),
    onSuccess: () => {
      toast({
        title: "Add Mini App quest completed! 🎉",
        description: "+5 points earned for adding TravelMint!"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats', String(farcasterUser.fid)] });
    },
    onError: (error) => {
      // Check if already completed
      if (error?.message?.includes('already completed')) {
        toast({
          title: "Quest Already Completed",
          description: "You've already claimed this reward!",
          variant: "default"
        });
      } else {
        toast({
          title: "Failed to claim quest",
          description: "Please try again later",
          variant: "destructive"
        });
      }
    }
  });

  // Claim referral rewards mutation
  const claimReferralMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/quests/claim-referral', {
      farcasterFid: String(farcasterUser.fid)
    }),
    onSuccess: (response: any) => {
      console.log('📥 Referral claim response:', response);
      const pointsEarned = response.pointsEarned || 0;
      console.log('🎁 Points earned:', pointsEarned);
      toast({
        title: "Referral rewards claimed! 🎁",
        description: `+${pointsEarned} point${pointsEarned > 1 ? 's' : ''} earned from referrals!`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-stats', String(farcasterUser.fid)] });
    },
    onError: (error) => {
      if (error?.message?.includes('No unclaimed referrals')) {
        toast({
          title: "No Unclaimed Referrals",
          description: "You don't have any pending referral rewards to claim.",
          variant: "default"
        });
      } else {
        toast({
          title: "Failed to claim referral rewards",
          description: "Please try again later",
          variant: "destructive"
        });
      }
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
            description: "+1 point earned for Base transaction!"
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

  // Auto-claim Add Mini App quest when app is added
  useEffect(() => {
    if (farcasterUser?.added && userStats && !userStats.hasAddedMiniApp && !addMiniAppMutation.isPending) {
      console.log('🎯 Auto-claiming Add Mini App quest - app is added and quest not completed');
      addMiniAppMutation.mutate();
    }
  }, [farcasterUser?.added, userStats?.hasAddedMiniApp, userStats]);


  if (statsLoading) {
    return (
      <div className="container mx-auto px-4">
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
  const hasClaimedSocialPost = todayQuests.some(q => q.questType === 'social_post');


  return (
    <div className="container mx-auto px-4 max-w-4xl pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Daily Quests</h1>
        <p className="text-sm text-muted-foreground">
          Complete tasks to earn points
        </p>
      </div>

      {/* Farcaster Connection Banner */}
      {!farcasterUser && (
        <div className="mb-6 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
            Connect via Farcaster to claim quest rewards
          </p>
        </div>
      )}

      {/* Daily Quests */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Today's Quests</h2>
        
        {/* Daily Check-in */}
        <Card className="bg-card/50 border-border/50 p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-base font-semibold">Daily Check-in</h3>
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs px-2 py-0.5">
              +1 Point
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Visit TravelMint and claim your daily point
          </p>
          <Button
            onClick={() => farcasterUser && checkInMutation.mutate()}
            disabled={!farcasterUser || hasCheckedInToday || checkInMutation.isPending}
            variant="outline"
            className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
            data-testid="button-daily-checkin"
          >
            {!farcasterUser ? "Connect via Farcaster First"
             : hasCheckedInToday ? "✓ Completed Today" 
             : "Claim"}
          </Button>
        </Card>

        {/* Holder Bonus */}
        <Card className="bg-card/50 border-border/50 p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-base font-semibold">Holder Bonus</h3>
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs px-2 py-0.5">
              +{((holderStatus?.nftCount || 0) * 0.15).toFixed(2)} Point{((holderStatus?.nftCount || 0) * 0.15 !== 0.15) ? 's' : ''}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Earn 0.15 point per NFT owned
          </p>
          <Button
            onClick={() => farcasterUser && holderBonusMutation.mutate()}
            disabled={!farcasterUser || !holderStatus?.isHolder || hasClaimedHolderBonus || holderBonusMutation.isPending}
            variant="outline"
            className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
            data-testid="button-holder-bonus"
          >
            {!farcasterUser ? "Connect via Farcaster First"
             : !holderStatus?.isHolder ? "No NFTs Found"
             : hasClaimedHolderBonus ? "✓ Completed Today"
             : "Claim"}
          </Button>
        </Card>

        {/* Base Network Transaction */}
        <Card className="bg-card/50 border-border/50 p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-base font-semibold">Hello TravelMint</h3>
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs px-2 py-0.5">
              +1 Point
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Onchain Tx tasks
          </p>
          <Button
            onClick={() => farcasterUser && sendTransaction({
              to: "0x000000000000000000000000000000000000dEaD",
              value: parseEther('0')
            })}
            disabled={!farcasterUser || !address || hasClaimedBaseTransaction || isClaimPending || isClaimConfirming}
            variant="outline"
            className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
            data-testid="button-base-transaction"
          >
            {!farcasterUser ? "Connect via Farcaster First"
             : !address ? "Connect Wallet First" 
             : hasClaimedBaseTransaction ? "✓ Completed Today"
             : "Claim"}
          </Button>
        </Card>

        {/* Daily Post Quest */}
        <Card className="bg-card/50 border-border/50 p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-base font-semibold">Daily Farcaster Cast</h3>
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs px-2 py-0.5">
              +5 Points
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Cast with TravelMint to earn 5 points
          </p>
          <div className="space-y-3">
            <Input
              placeholder="Paste your Farcaster cast URL..."
              value={castUrl}
              onChange={(e) => setCastUrl(e.target.value)}
              disabled={!farcasterUser || hasClaimedSocialPost}
              className="text-sm"
              data-testid="input-cast-url"
            />
            <Button
              onClick={() => farcasterUser && socialPostMutation.mutate()}
              disabled={!farcasterUser || !castUrl.trim() || hasClaimedSocialPost || socialPostMutation.isPending}
              variant="outline"
              className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
              data-testid="button-daily-post"
            >
              {!farcasterUser ? "Connect via Farcaster First"
               : hasClaimedSocialPost ? "✓ Completed Today"
               : "Claim"}
            </Button>
          </div>
        </Card>
      </div>

      {/* One-Time Quests */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">One-Time Quests</h2>
          <Badge variant="outline" className="text-xs px-2 py-0">
            Complete Once
          </Badge>
        </div>
        
        {/* Add Mini App Quest */}
        <Card className="bg-card/50 border-border/50 p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-base font-semibold">Add TravelMint</h3>
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs px-2 py-0.5">
              +5 Points
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Add TravelMint to your Farcaster apps
          </p>
          <Button
            onClick={() => farcasterUser && addMiniAppMutation.mutate()}
            disabled={!farcasterUser || userStats?.hasAddedMiniApp || addMiniAppMutation.isPending}
            variant="outline"
            className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
            data-testid="button-add-miniapp"
          >
            {!farcasterUser ? "Connect via Farcaster First"
             : userStats?.hasAddedMiniApp ? "✓ Completed"
             : "Claim"}
          </Button>
        </Card>

        {/* Referral Program Quest */}
        <Card className="bg-card/50 border-border/50 p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-base font-semibold">Invite Friends</h3>
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs px-2 py-0.5">
              +1 Per Referral
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Earn 1 point for each friend who joins using your referral link
          </p>
          <div className="space-y-3">
            {(userStats?.referralCount ?? 0) > 0 && (
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-xs font-medium">
                  🎉 {userStats?.referralCount ?? 0} friend{(userStats?.referralCount ?? 0) > 1 ? 's' : ''} invited
                </p>
              </div>
            )}
            
            {/* Show Claim button if there are unclaimed referrals */}
            {(userStats?.unclaimedReferrals ?? 0) > 0 ? (
              <>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5">
                  <p className="text-xs font-medium text-orange-400">
                    🎁 {userStats?.unclaimedReferrals ?? 0} new referral{(userStats?.unclaimedReferrals ?? 0) > 1 ? 's' : ''} to claim!
                  </p>
                </div>
                <Button
                  onClick={() => claimReferralMutation.mutate()}
                  disabled={!farcasterUser || claimReferralMutation.isPending}
                  variant="outline"
                  className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
                  data-testid="button-claim-referral"
                >
                  {claimReferralMutation.isPending ? "Claiming..." : `Claim +${userStats?.unclaimedReferrals ?? 0} Point${(userStats?.unclaimedReferrals ?? 0) > 1 ? 's' : ''}`}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = '/my-nfts';
                  }
                }}
                disabled={!farcasterUser}
                variant="outline"
                className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10"
                data-testid="button-view-referral"
              >
                {!farcasterUser ? "Connect via Farcaster First"
                 : (userStats?.referralCount ?? 0) > 0 ? "View Link"
                 : "Get Link"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}