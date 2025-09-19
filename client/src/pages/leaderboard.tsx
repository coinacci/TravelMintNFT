import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trophy, Medal, Award, Crown, Target, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import sdk from "@farcaster/frame-sdk";
import { useAccount } from "wagmi";
import ComposeCastButton from "@/components/ComposeCastButton";
import WeeklyChampionBadge from "@/components/WeeklyChampionBadge";

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

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <div className="h-6 w-6 flex items-center justify-center text-sm font-bold text-muted-foreground">#{rank}</div>;
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <Trophy className="h-12 w-12 mx-auto text-primary mb-4" />
        <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
        <p className="text-muted-foreground">
          Top quest completers in the TravelMint community
        </p>
      </div>

      {/* Current User Position - All Time */}
      {allTimeUserEntry && (
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-center">Your Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-background">
              <div className="flex items-center space-x-4">
                {getRankIcon(allTimeUserEntry.rank)}
                <Avatar className="h-10 w-10">
                  {/* <AvatarImage src={farcasterUser.pfpUrl} alt={allTimeUserEntry.farcasterUsername} /> */}
                  <AvatarFallback>{allTimeUserEntry.farcasterUsername.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{allTimeUserEntry.farcasterUsername}</p>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <span>Streak: {allTimeUserEntry.currentStreak} days</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold" data-testid="user-points">{pointsToDisplay(allTimeUserEntry.totalPoints)}</div>
                <div className="text-sm text-muted-foreground">all-time points</div>
              </div>
            </div>
            
            {/* Share Position Button */}
            <div className="mt-4 pt-4 border-t border-muted">
              <ComposeCastButton
                type="leaderboard"
                leaderboardPosition={allTimeUserEntry.rank}
                totalPoints={parseFloat(pointsToDisplay(allTimeUserEntry.totalPoints))}
                variant="outline"
                size="sm"
                className="w-full"
              />
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
                          : 'bg-muted/50 hover:bg-muted'
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
              {/* Show latest weekly champion if exists and week has ended */}
              {weeklyChampions.length > 0 && (() => {
                const today = new Date();
                const championWeekEnd = new Date(weeklyChampions[0].weekEndDate);
                const hasWeekEnded = today > championWeekEnd;
                
                return hasWeekEnded && (
                  <div className="mb-6 p-4 border rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg">Previous Weekly Champion</h3>
                        <p className="text-sm text-muted-foreground">@{weeklyChampions[0].farcasterUsername}</p>
                      </div>
                      <WeeklyChampionBadge
                        weekNumber={weeklyChampions[0].weekNumber}
                        year={weeklyChampions[0].year}
                        weekStartDate={weeklyChampions[0].weekStartDate}
                        weekEndDate={weeklyChampions[0].weekEndDate}
                      />
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Won with {pointsToDisplay(weeklyChampions[0].weeklyPoints)} points
                    </div>
                  </div>
                );
              })()}
              
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
                          : 'bg-muted/50 hover:bg-muted'
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
              {weeklyChampions.length === 0 ? (
                <div className="text-center py-8">
                  <Crown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No champions yet. Be the first to win a weekly championship!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {weeklyChampions.map((champion) => (
                    <div
                      key={`${champion.farcasterFid}-${champion.weekNumber}-${champion.year}`}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors border border-primary/20"
                      data-testid={`champion-row-${champion.weekNumber}-${champion.year}`}
                    >
                      <div className="flex items-center space-x-4">
                        <WeeklyChampionBadge
                          weekNumber={champion.weekNumber}
                          year={champion.year}
                          weekStartDate={champion.weekStartDate}
                          weekEndDate={champion.weekEndDate}
                          className="h-10 w-10"
                        />
                        <div>
                          <p className="font-medium" data-testid={`champion-username-${champion.weekNumber}`}>
                            @{champion.farcasterUsername}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Week {champion.weekNumber}, {champion.year} Champion
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(champion.weekStartDate).toLocaleDateString()} - {new Date(champion.weekEndDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg" data-testid={`champion-points-${champion.weekNumber}`}>
                          {pointsToDisplay(champion.weeklyPoints)}
                        </div>
                        <div className="text-sm text-muted-foreground">winning points</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}