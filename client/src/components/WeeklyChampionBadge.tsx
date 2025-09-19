import { Badge } from "@/components/ui/badge";
import { Crown, Calendar } from "lucide-react";

interface WeeklyChampionBadgeProps {
  weekNumber: number;
  year: number;
  weekStartDate: string;
  weekEndDate: string;
  className?: string;
}

export default function WeeklyChampionBadge({ 
  weekNumber, 
  year, 
  weekStartDate, 
  weekEndDate, 
  className = "" 
}: WeeklyChampionBadgeProps) {
  // Format dates for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="default" className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-0 px-3 py-1 flex items-center gap-2">
        <Crown className="h-4 w-4" />
        <span className="font-bold">Week {weekNumber} Champion</span>
      </Badge>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span>{formatDate(weekStartDate)} - {formatDate(weekEndDate)} {year}</span>
      </div>
    </div>
  );
}