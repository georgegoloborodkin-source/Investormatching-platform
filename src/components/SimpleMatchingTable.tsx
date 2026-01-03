import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Filter, Lock, Unlock } from "lucide-react";
import { Match, Startup, Investor } from "@/types";

interface SimpleMatchingTableProps {
  matches: Match[];
  startups: Startup[];
  investors: Investor[];
  onToggleCompleted: (matchId: string) => void;
  onToggleLocked: (matchId: string) => void;
  onUpdateMatch: (matchId: string, updates: Partial<Match>) => void;
}

export function SimpleMatchingTable({ 
  matches, 
  startups, 
  investors,
  onToggleCompleted,
  onToggleLocked,
  onUpdateMatch
}: SimpleMatchingTableProps) {
  const [sortField, setSortField] = useState<string>('timeSlot');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = useState(true);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedMatches = matches
    .filter(match => showCompleted || !match.completed)
    .sort((a, b) => {
      const aValue = a[sortField as keyof Match];
      const bValue = b[sortField as keyof Match];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-success text-success-foreground';
    if (score >= 60) return 'bg-primary text-primary-foreground';
    if (score >= 40) return 'bg-warning text-warning-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  const getInvestorStatus = (investorId: string) => {
    const investor = investors.find(i => i.id === investorId);
    return investor?.availabilityStatus || 'present';
  };

  const handleStartupChange = (matchId: string, startupId: string) => {
    const startup = startups.find(s => s.id === startupId);
    if (startup) {
      onUpdateMatch(matchId, {
        startupId: startup.id,
        startupName: startup.companyName
      });
    }
  };

  const handleInvestorChange = (matchId: string, investorId: string) => {
    const investor = investors.find(i => i.id === investorId);
    if (investor) {
      onUpdateMatch(matchId, {
        investorId: investor.id,
        investorName: `${investor.firmName} (${investor.memberName})`
      });
    }
  };


  if (matches.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-medium mb-2">No matches generated yet</h3>
        <p className="text-muted-foreground">
          Add startups and investors, then click "Generate Matches" to create your matchmaking schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border bg-table-header">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Matchmaking Schedule</h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={showCompleted}
                onCheckedChange={(checked) => setShowCompleted(checked === true)}
              />
              Show completed
            </label>
            <span className="text-sm text-muted-foreground">
              {matches.filter(m => m.completed).length} / {matches.length} completed
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-table-header border-b border-table-border">
            <tr>
              <th className="text-left p-3 w-12">Done</th>
              <th 
                className="text-left p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('startupName')}
              >
                <div className="flex items-center gap-1">
                  Startup
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th 
                className="text-left p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('investorName')}
              >
                <div className="flex items-center gap-1">
                  Investor
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th 
                className="text-left p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('compatibilityScore')}
              >
                <div className="flex items-center gap-1">
                  Score
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="text-left p-3">Lock</th>
            </tr>
          </thead>
          <tbody>
            {sortedMatches.map((match) => {
              const investorStatus = getInvestorStatus(match.investorId);
              const isInvestorUnavailable = investorStatus !== 'present';
              
              return (
                <tr 
                  key={match.id} 
                  className={`border-b border-table-border hover:bg-table-row-hover transition-colors ${
                    match.completed ? 'opacity-60' : ''
                  } ${isInvestorUnavailable ? 'bg-destructive/10' : ''}`}
                >
                  <td className="p-3">
                    <Checkbox
                      checked={match.completed}
                      onCheckedChange={() => onToggleCompleted(match.id)}
                      disabled={isInvestorUnavailable}
                      className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                    />
                  </td>
                  <td className="p-3">
                    <Select
                      value={match.startupId}
                      onValueChange={(value) => handleStartupChange(match.id, value)}
                      disabled={match.completed}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select startup" />
                      </SelectTrigger>
                      <SelectContent>
                        {startups
                          .filter(s => s.availabilityStatus === 'present')
                          .map((startup) => (
                            <SelectItem key={startup.id} value={startup.id}>
                              {startup.companyName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Select
                        value={match.investorId}
                        onValueChange={(value) => handleInvestorChange(match.id, value)}
                        disabled={match.completed}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select investor" />
                        </SelectTrigger>
                        <SelectContent>
                          {investors
                            .filter(i => i.availabilityStatus === 'present')
                            .map((investor) => (
                              <SelectItem key={investor.id} value={investor.id}>
                                {investor.firmName} ({investor.memberName})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {isInvestorUnavailable && (
                        <Badge variant="secondary" className="text-xs">
                          Unavailable
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge className={getScoreColor(match.compatibilityScore)}>
                      {match.compatibilityScore}%
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleLocked(match.id)}
                      className="h-8 w-8 p-0"
                    >
                      {match.locked ? (
                        <Lock className="h-4 w-4 text-warning" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}