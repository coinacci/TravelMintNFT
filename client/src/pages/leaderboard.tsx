import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trophy, Medal, Award, Crown, Target, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import sdk from "@farcaster/frame-sdk";
import { useAccount } from "wagmi";
import ComposeCastButton from "@/components/ComposeCastButton";

// Helper function to convert fixed-point values (stored as integers * 100) to display format
const pointsToDisplay = (points: number): string => {
  return (points / 100).toFixed(2);
};

interface LeaderboardEntry {
  farcasterFid: string;
  farcasterUsername: string;
  farcasterPfpUrl?: string; // Profile picture URL
  totalPoints: number;
  weeklyPoints?: number; // Optional for weekly leaderboard entries
  currentStreak: number;
  rank: number;
}

export default function Leaderboard() {
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  const { address, isConnected } = useAccount();
  
  console.log('🎯 Leaderboard rendering with:', { 
    farcasterUser: farcasterUser?.username || 'none', 
    isConnected 
  });
  
  // Get Farcaster user context
  useEffect(() => {
    const getFarcasterContext = async () => {
      try {
        if (typeof window !== 'undefined' && sdk?.context) {
          // Handle both promise and non-promise context
          let context: any;
          try {
            context = await Promise.resolve(sdk.context);
          } catch (contextError) {
            // Fallback: try treating it as a direct object
            context = sdk.context as any;
          }
          
          if (context?.user) {
            console.log('✅ Farcaster user found in leaderboard:', context.user.username);
            setFarcasterUser({
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl
            });
          } else {
            console.log('ℹ️ No Farcaster user in context');
          }
        } else {
          console.log('ℹ️ No Farcaster SDK available in leaderboard');
        }
      } catch (error) {
        console.error('❌ Error getting Farcaster context in leaderboard:', error);
        // Don't throw - just continue without Farcaster context
      }
    };
    
    // Add delay to prevent blocking and race conditions
    setTimeout(() => {
      getFarcasterContext();
    }, 200);
  }, []);

  // Check if user has access (either Farcaster or connected wallet)
  // In Farcaster environment, always enable queries initially - access check happens on server
  const hasAccess = true; // Changed to always true - server will handle access control

  // Fetch all-time leaderboard data
  const { data: allTimeLeaderboard = [], isLoading: isAllTimeLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/leaderboard'],
    enabled: hasAccess,
  });

  // Fetch weekly leaderboard data
  const { data: weeklyLeaderboard = [], isLoading: isWeeklyLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/leaderboard/weekly'],
    enabled: hasAccess,
  });

  // Fetch weekly champions data
  const { data: weeklyChampions = [] } = useQuery<any[]>({
    queryKey: ['/api/weekly-champions'],
    enabled: hasAccess,
  });

  // Find current user's position in both leaderboards
  const allTimeUserEntry = allTimeLeaderboard.find(entry => entry.farcasterFid === String(farcasterUser?.fid));
  const weeklyUserEntry = weeklyLeaderboard.find(entry => entry.farcasterFid === String(farcasterUser?.fid));

  // Server handles access control, so we don't need to block UI here
  // This prevents issues in Farcaster environment where context loads asynchronously

  if (isAllTimeLoading || isWeeklyLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  const getRankIcon = (rank: number, compact = false) => {
    const size = compact ? "h-5 w-5" : "h-6 w-6";
    const textSize = compact ? "text-xs" : "text-sm";
    
    switch (rank) {
      case 1:
        return <Crown className={`${size} text-yellow-500`} />;
      case 2:
        return <Medal className={`${size} text-gray-400`} />;
      case 3:
        return <Award className={`${size} text-amber-600`} />;
      default:
        return <div className={`${size} flex items-center justify-center ${textSize} font-bold text-muted-foreground`}>#{rank}</div>;
    }
  };

  const getRankBadgeVariant = (rank: number) => {
    switch (rank) {
      case 1:
        return "default" as const;
      case 2:
      case 3:
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="container mx-auto px-4 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <Trophy className="h-12 w-12 mx-auto text-primary mb-4" />
        <h1 className="text-2xl md:text-4xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">
          Top quest completers in the TravelMint community
        </p>
      </div>


      {/* Current User Position - All Time - Compact */}
      {allTimeUserEntry && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getRankIcon(allTimeUserEntry.rank, true)}
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs">{allTimeUserEntry.farcasterUsername.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm truncate block min-w-0">{allTimeUserEntry.farcasterUsername}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <div className="text-lg font-bold" data-testid="user-points">{pointsToDisplay(allTimeUserEntry.totalPoints)}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
                <ComposeCastButton
                  type="leaderboard"
                  leaderboardPosition={allTimeUserEntry.rank}
                  totalPoints={parseFloat(pointsToDisplay(allTimeUserEntry.totalPoints))}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Rankings with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>All Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all-time" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all-time" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                All Time
              </TabsTrigger>
              <TabsTrigger value="weekly" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Weekly
              </TabsTrigger>
              <TabsTrigger value="champions" className="flex items-center gap-2">
                <Crown className="h-4 w-4" />
                Champions
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all-time">
              {allTimeLeaderboard.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No quest completers yet. Be the first!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allTimeLeaderboard.map((entry) => (
                    <div
                      key={entry.farcasterFid}
                      className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                        entry.farcasterFid === farcasterUser?.fid 
                          ? 'bg-primary/10 border border-primary/20' 
                          : 'bg-muted/50'
                      }`}
                      data-testid={`leaderboard-row-${entry.rank}`}
                    >
                      <div className="flex items-center space-x-4">
                        <Badge variant={getRankBadgeVariant(entry.rank)}>
                          #{entry.rank}
                        </Badge>
                        <Avatar className="h-8 w-8">
                          {/* <AvatarImage src={entry.farcasterPfpUrl} alt={entry.farcasterUsername} /> */}
                          <AvatarFallback>{entry.farcasterUsername.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium" data-testid={`row-${entry.rank}-username`}>{entry.farcasterUsername}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.currentStreak} day streak
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold" data-testid={`row-${entry.rank}-points`}>{pointsToDisplay(entry.totalPoints)}</div>
                        <div className="text-sm text-muted-foreground">points</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="weekly">
              
              {weeklyLeaderboard.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No weekly quest completers yet. Start completing quests to be this week's champion!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {weeklyLeaderboard.map((entry) => (
                    <div
                      key={entry.farcasterFid}
                      className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                        entry.farcasterFid === farcasterUser?.fid 
                          ? 'bg-primary/10 border border-primary/20' 
                          : 'bg-muted/50'
                      }`}
                      data-testid={`weekly-leaderboard-row-${entry.rank}`}
                    >
                      <div className="flex items-center space-x-4">
                        <Badge variant={getRankBadgeVariant(entry.rank)}>
                          #{entry.rank}
                        </Badge>
                        <Avatar className="h-8 w-8">
                          {/* <AvatarImage src={entry.farcasterPfpUrl} alt={entry.farcasterUsername} /> */}
                          <AvatarFallback>{entry.farcasterUsername.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium" data-testid={`weekly-row-${entry.rank}-username`}>{entry.farcasterUsername}</p>
                          <p className="text-sm text-muted-foreground">
                            This week's points
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold" data-testid={`weekly-row-${entry.rank}-points`}>{pointsToDisplay(entry.weeklyPoints || 0)}</div>
                        <div className="text-sm text-muted-foreground">weekly points</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="champions">
              {(() => {
                // Show all champions with valid usernames
                const validChampions = weeklyChampions.filter(champion => {
                  return champion.farcasterUsername && champion.farcasterUsername.trim() !== '';
                });
                
                return validChampions.length === 0 ? (
                  <div className="text-center py-8">
                    <Crown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No champions yet. Complete quests to become the weekly champion!</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] w-full">
                    <div className="space-y-3 pr-4">
                      {validChampions.map((champion) => (
                      <div
                        key={`${champion.farcasterFid}-${champion.weekNumber}-${champion.year}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-700"
                        data-testid={`champion-row-${champion.weekNumber}-${champion.year}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-yellow-500 rounded-full">
                            <Crown className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-lg text-black" data-testid={`champion-username-${champion.weekNumber}`}>
                              @{champion.farcasterUsername}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-xl text-yellow-600 dark:text-yellow-400" data-testid={`champion-points-${champion.weekNumber}`}>
                            {pointsToDisplay(champion.weeklyPoints)}
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                  </ScrollArea>
                );
              })()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}