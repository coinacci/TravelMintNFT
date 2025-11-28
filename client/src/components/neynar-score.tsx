import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Users, UserCheck, Star, AlertCircle } from "lucide-react";

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
  if (score >= 0.8) return "text-green-500";
  if (score >= 0.6) return "text-blue-500";
  if (score >= 0.4) return "text-yellow-500";
  return "text-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 0.8) return "Excellent";
  if (score >= 0.6) return "Good";
  if (score >= 0.4) return "Fair";
  return "Low";
}

function getScoreBgColor(score: number): string {
  if (score >= 0.8) return "bg-green-500/10";
  if (score >= 0.6) return "bg-blue-500/10";
  if (score >= 0.4) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

export default function NeynarScore({ fid }: NeynarScoreProps) {
  const { data, isLoading, error } = useQuery<NeynarScoreData>({
    queryKey: ['/api/neynar/score', fid],
    enabled: !!fid,
  });

  if (!fid) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-500" />
            Neynar Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            Neynar Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>Unable to load score</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const score = data.neynarScore;
  const scorePercent = Math.round(score * 100);

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800" data-testid="neynar-score-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-500" />
          Neynar Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getScoreBgColor(score)}`}>
              <span className={`text-2xl font-bold ${getScoreColor(score)}`} data-testid="neynar-score-value">
                {scorePercent}
              </span>
            </div>
            <div>
              <div className={`text-lg font-semibold ${getScoreColor(score)}`} data-testid="neynar-score-label">
                {getScoreLabel(score)}
              </div>
              <div className="text-xs text-muted-foreground">
                Account Quality Score
              </div>
            </div>
          </div>
          <div className="text-right">
            <Star className={`w-6 h-6 ${getScoreColor(score)}`} />
          </div>
        </div>

        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              score >= 0.8 ? 'bg-green-500' :
              score >= 0.6 ? 'bg-blue-500' :
              score >= 0.4 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
            style={{ width: `${scorePercent}%` }}
            data-testid="neynar-score-bar"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Followers:</span>
            <span className="font-medium" data-testid="neynar-followers">{data.followerCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <UserCheck className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Following:</span>
            <span className="font-medium" data-testid="neynar-following">{data.followingCount.toLocaleString()}</span>
          </div>
        </div>

        {data.verifiedAddresses && data.verifiedAddresses.length > 0 && (
          <div className="pt-2 border-t border-purple-200 dark:border-purple-700">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3 h-3 text-green-500" />
              <span>{data.verifiedAddresses.length} verified wallet{data.verifiedAddresses.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-1">
          Powered by Neynar • Score updates weekly
        </div>
      </CardContent>
    </Card>
  );
}
