import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trophy, Medal, Award, Crown, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import sdk from "@farcaster/frame-sdk";

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

  // Fetch leaderboard data
  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/leaderboard'],
    enabled: !!farcasterUser,
  });

  // Find current user's position
  const currentUserEntry = leaderboard.find(entry => entry.farcasterFid === farcasterUser?.fid);

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

  if (isLoading) {
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

      {/* Current User Position */}
      {currentUserEntry && (
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-center">Your Position</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-background">
              <div className="flex items-center space-x-4">
                {getRankIcon(currentUserEntry.rank)}
                <Avatar className="h-10 w-10">
                  <AvatarImage src={farcasterUser.pfpUrl} alt={currentUserEntry.farcasterUsername} />
                  <AvatarFallback>{currentUserEntry.farcasterUsername.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{currentUserEntry.farcasterUsername}</p>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <span>Streak: {currentUserEntry.currentStreak} days</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold" data-testid="user-points">{pointsToDisplay(currentUserEntry.totalPoints)}</div>
                <div className="text-sm text-muted-foreground">points</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-center">Top 3</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[2, 1, 3].map((position) => {
              const entry = leaderboard.find(e => e.rank === position);
              if (!entry) return null;
              
              return (
                <Card 
                  key={entry.farcasterFid} 
                  className={`${position === 1 ? 'order-2 md:order-2 scale-105' : position === 2 ? 'order-1 md:order-1' : 'order-3 md:order-3'} ${
                    entry.farcasterFid === farcasterUser?.fid ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <CardContent className="p-6 text-center">
                    <div className="mb-4">
                      {getRankIcon(entry.rank)}
                    </div>
                    <Avatar className="h-16 w-16 mx-auto mb-3">
                      <AvatarFallback>{entry.farcasterUsername.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h3 className="font-bold mb-1" data-testid={`rank-${entry.rank}-username`}>{entry.farcasterUsername}</h3>
                    <p className="text-2xl font-bold text-primary mb-2" data-testid={`rank-${entry.rank}-points`}>{pointsToDisplay(entry.totalPoints)}</p>
                    <Badge variant="secondary">
                      {entry.currentStreak} day streak
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>All Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No quest completers yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
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
        </CardContent>
      </Card>
    </div>
  );
}