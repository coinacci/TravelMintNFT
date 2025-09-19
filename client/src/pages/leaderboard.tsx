import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trophy, Medal, Award, Crown, Target, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import sdk from "@farcaster/frame-sdk";
import ComposeCastButton from "@/components/ComposeCastButton";

// Helper function to convert fixed-point values (stored as integers * 100) to display format
const pointsToDisplay = (points: number): string => {
  return (points / 100).toFixed(2);
};

interface LeaderboardEntry {
  farcasterFid: string;
  farcasterUsername: string;
  totalPoints: number;
  currentStreak: number;
  rank: number;
}

export default function Leaderboard() {
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  
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
        console.log('ℹ️ No Farcaster context in leaderboard');
      }
    };
    
    getFarcasterContext();
  }, []);

  // Fetch all-time leaderboard data
  const { data: allTimeLeaderboard = [], isLoading: isAllTimeLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/leaderboard'],
    enabled: !!farcasterUser,
  });

  // Fetch weekly leaderboard data
  const { data: weeklyLeaderboard = [], isLoading: isWeeklyLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/leaderboard/weekly'],
    enabled: !!farcasterUser,
  });

  // Find current user's position in both leaderboards
  const allTimeUserEntry = allTimeLeaderboard.find(entry => entry.farcasterFid === String(farcasterUser?.fid));
  const weeklyUserEntry = weeklyLeaderboard.find(entry => entry.farcasterFid === String(farcasterUser?.fid));

  if (!farcasterUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Farcaster Only</h1>
          <p className="text-muted-foreground">
            Leaderboard is only available when accessing through Farcaster.
          </p>
        </div>
      </div>
    );
  }

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
                  <AvatarImage src={farcasterUser.pfpUrl} alt={allTimeUserEntry.farcasterUsername} />
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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all-time" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                All Time
              </TabsTrigger>
              <TabsTrigger value="weekly" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Weekly
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
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                      data-testid={`weekly-leaderboard-row-${entry.rank}`}
                    >
                      <div className="flex items-center space-x-4">
                        <Badge variant={getRankBadgeVariant(entry.rank)}>
                          #{entry.rank}
                        </Badge>
                        <Avatar className="h-8 w-8">
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}