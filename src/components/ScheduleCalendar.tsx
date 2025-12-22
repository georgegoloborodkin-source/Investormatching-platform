import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CalendarDays, Edit2, Save, X } from "lucide-react";
import { Match, Startup, Investor } from "@/types";

interface ScheduleCalendarProps {
  matches: Match[];
  startups: Startup[];
  investors: Investor[];
  onUpdateScore: (matchId: string, newScore: number) => void;
  onToggleCompleted: (matchId: string) => void;
}

export function ScheduleCalendar({
  matches,
  startups,
  investors,
  onUpdateScore,
  onToggleCompleted
}: ScheduleCalendarProps) {
  const [editingScore, setEditingScore] = useState<string | null>(null);
  const [tempScore, setTempScore] = useState<number>(0);

  // Group matches by time slots
  const groupedMatches = matches.reduce((acc, match) => {
    if (!acc[match.timeSlot]) {
      acc[match.timeSlot] = [];
    }
    acc[match.timeSlot].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  const timeSlots = Object.keys(groupedMatches).sort((a, b) => {
    const aNum = parseInt(a.replace('Slot ', ''));
    const bNum = parseInt(b.replace('Slot ', ''));
    return aNum - bNum;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const handleStartEditScore = (matchId: string, currentScore: number) => {
    setEditingScore(matchId);
    setTempScore(currentScore);
  };

  const handleSaveScore = (matchId: string) => {
    if (tempScore >= 0 && tempScore <= 100) {
      onUpdateScore(matchId, tempScore);
      setEditingScore(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingScore(null);
    setTempScore(0);
  };

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Schedule Generated</h3>
          <p className="text-muted-foreground">
            Generate matches to see the calendar view of the matchmaking schedule.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Schedule Calendar</h2>
        <div className="text-sm text-muted-foreground">
          {matches.filter(m => m.completed).length} / {matches.length} meetings completed
        </div>
      </div>

      <div className="grid gap-6">
        {timeSlots.map((timeSlot) => (
          <Card key={timeSlot} className="overflow-hidden">
            <CardHeader className="pb-3 bg-muted/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                {timeSlot}
                <Badge variant="secondary" className="ml-auto">
                  {groupedMatches[timeSlot].length} meetings
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedMatches[timeSlot].map((match) => {
                  const startup = startups.find(s => s.id === match.startupId);
                  const investor = investors.find(i => i.id === match.investorId);
                  
                  return (
                    <div
                      key={match.id}
                      className={`p-4 border rounded-lg transition-all hover:shadow-md ${
                        match.completed 
                          ? 'bg-green-50 border-green-200 opacity-75' 
                          : 'bg-card hover:bg-accent/50'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Meeting participants */}
                        <div className="space-y-2">
                          <div className="font-medium text-primary truncate">
                            {match.startupName}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            vs {match.investorName}
                            {investor?.tableNumber && (
                              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                Table {investor.tableNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Compatibility score */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Compatibility</span>
                          {editingScore === match.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={tempScore}
                                onChange={(e) => setTempScore(parseInt(e.target.value) || 0)}
                                className="w-16 h-6 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveScore(match.id)}
                                className="h-6 w-6 p-0"
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelEdit}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Badge className={`${getScoreColor(match.compatibilityScore)} text-xs cursor-pointer`}>
                                {match.compatibilityScore}%
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartEditScore(match.id, match.compatibilityScore)}
                                className="h-6 w-6 p-0"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Match details */}
                        {startup && investor && (
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>Industry: {startup.industry}</div>
                            <div>Target: ${(startup.fundingTarget / 1000000).toFixed(1)}M</div>
                            <div>Range: ${(investor.minTicketSize / 1000000).toFixed(1)}M - ${(investor.maxTicketSize / 1000000).toFixed(1)}M</div>
                          </div>
                        )}

                        {/* Completion toggle */}
                        <div className="pt-2 border-t border-border">
                          <Button
                            size="sm"
                            variant={match.completed ? "default" : "outline"}
                            onClick={() => onToggleCompleted(match.id)}
                            className="w-full text-xs"
                          >
                            {match.completed ? "✓ Completed" : "Mark Complete"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}