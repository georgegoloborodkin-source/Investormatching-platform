import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Filter, Lock, Unlock } from "lucide-react";
import { Match, Startup, Investor, Mentor, CorporatePartner } from "@/types";

interface SimpleMatchingTableProps {
  matches: Match[];
  startups: Startup[];
  investors: Investor[];
  mentors?: Mentor[];
  corporates?: CorporatePartner[];
  onToggleCompleted: (matchId: string) => void;
  onToggleLocked: (matchId: string) => void;
  onUpdateMatch: (matchId: string, updates: Partial<Match>) => void;
}

export function SimpleMatchingTable({ 
  matches, 
  startups, 
  investors,
  mentors = [],
  corporates = [],
  onToggleCompleted,
  onToggleLocked,
  onUpdateMatch
}: SimpleMatchingTableProps) {
  const [sortField, setSortField] = useState<string>('timeSlot');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = useState(true);
  const [startupFilter, setStartupFilter] = useState<string>('all');

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
    .filter(match => startupFilter === 'all' || match.startupId === startupFilter)
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
    if (score >= 80) return 'border-[#FFED00] text-[#FFED00] bg-transparent';
    if (score >= 60) return 'border-white text-white bg-transparent';
    if (score >= 40) return 'border-white/70 text-white/70 bg-transparent';
    return 'border-white/50 text-white/50 bg-transparent';
  };

  const getTargetStatus = (match: Match) => {
    const targetId = match.targetId || match.investorId || '';
    const targetType = match.targetType || 'investor';
    
    if (targetType === 'investor') {
      const investor = investors.find(i => i.id === targetId);
      return investor?.availabilityStatus || 'present';
    } else if (targetType === 'mentor') {
      const mentor = mentors.find(m => m.id === targetId);
      return mentor?.availabilityStatus || 'present';
    } else {
      const corporate = corporates.find(c => c.id === targetId);
      return corporate?.availabilityStatus || 'present';
    }
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
      <div className="border-2 border-white bg-transparent rounded-lg p-8 text-center">
        <Filter className="h-12 w-12 mx-auto mb-4 text-white/50 opacity-50" />
        <h3 className="text-lg font-mono font-bold mb-2 text-white">No matches generated yet</h3>
        <p className="text-white/70 font-mono">
          Add startups and investors, then click "Generate Matches" to create your matchmaking schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-white bg-transparent rounded-lg overflow-hidden">
      <div className="p-4 border-b-2 border-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-mono font-black uppercase tracking-tight text-white">Matchmaking Schedule</h2>
          <div className="flex items-center gap-2">
            <Select
              value={startupFilter}
              onValueChange={(val) => setStartupFilter(val)}
            >
              <SelectTrigger className="w-48 border-2 border-white bg-transparent text-white">
                <SelectValue placeholder="Filter by startup" />
              </SelectTrigger>
              <SelectContent className="bg-[#050505] border-2 border-white">
                <SelectItem value="all" className="text-white">All startups</SelectItem>
                {startups.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-white">
                    {s.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-white font-mono">
              <Checkbox
                checked={showCompleted}
                onCheckedChange={(checked) => setShowCompleted(checked === true)}
                className="border-white data-[state=checked]:bg-[#FFED00] data-[state=checked]:border-[#FFED00]"
              />
              Show completed
            </label>
            <span className="text-sm text-white/70 font-mono">
              {matches.filter(m => m.completed).length} / {matches.length} completed
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b-2 border-white">
            <tr>
              <th className="text-left p-3 w-12 text-white font-mono font-bold">Done</th>
              <th 
                className="text-left p-3 cursor-pointer hover:bg-[#FFED00]/10 transition-colors text-white font-mono font-bold"
                onClick={() => handleSort('startupName')}
              >
                <div className="flex items-center gap-1">
                  Startup
                  <ArrowUpDown className="h-3 w-3 text-[#FFED00]" />
                </div>
              </th>
              <th 
                className="text-left p-3 cursor-pointer hover:bg-[#FFED00]/10 transition-colors text-white font-mono font-bold"
                onClick={() => handleSort('targetName')}
              >
                <div className="flex items-center gap-1">
                  Partner
                  <ArrowUpDown className="h-3 w-3 text-[#FFED00]" />
                </div>
              </th>
              <th 
                className="text-left p-3 cursor-pointer hover:bg-[#FFED00]/10 transition-colors text-white font-mono font-bold"
                onClick={() => handleSort('compatibilityScore')}
              >
                <div className="flex items-center gap-1">
                  Score
                  <ArrowUpDown className="h-3 w-3 text-[#FFED00]" />
                </div>
              </th>
              <th className="text-left p-3 text-white font-mono font-bold">Lock</th>
            </tr>
          </thead>
          <tbody>
            {sortedMatches.map((match) => {
              const targetStatus = getTargetStatus(match);
              const isTargetUnavailable = targetStatus !== 'present';
              const displayName = match.targetName || match.investorName || 'Unknown';
              
              return (
                <tr 
                  key={match.id} 
                  className={`border-b border-white/30 hover:bg-[#FFED00]/5 transition-colors ${
                    match.completed ? 'opacity-60' : ''
                  } ${isTargetUnavailable ? 'bg-white/5' : ''}`}
                >
                  <td className="p-3">
                    <Checkbox
                      checked={match.completed}
                      onCheckedChange={() => onToggleCompleted(match.id)}
                      disabled={isTargetUnavailable}
                      className="border-white data-[state=checked]:bg-[#FFED00] data-[state=checked]:border-[#FFED00]"
                    />
                  </td>
                  <td className="p-3">
                    <Select
                      value={match.startupId}
                      onValueChange={(value) => handleStartupChange(match.id, value)}
                      disabled={match.completed}
                    >
                      <SelectTrigger className="w-full border-2 border-white bg-transparent text-white">
                        <SelectValue placeholder="Select startup" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#050505] border-2 border-white">
                        {startups
                          .filter(s => s.availabilityStatus === 'present')
                          .map((startup) => (
                            <SelectItem key={startup.id} value={startup.id} className="text-white">
                              {startup.companyName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-mono">{displayName}</span>
                      <Badge variant="outline" className="text-xs capitalize border-white text-white bg-transparent font-mono">
                        {match.targetType || 'investor'}
                      </Badge>
                      {isTargetUnavailable && (
                        <Badge variant="outline" className="text-xs border-white/50 text-white/50 bg-transparent font-mono">
                          Unavailable
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={getScoreColor(match.compatibilityScore) + " font-mono"}>
                      {match.compatibilityScore}%
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleLocked(match.id)}
                      className="h-8 w-8 p-0 text-white hover:text-[#FFED00] hover:bg-white/10"
                    >
                      {match.locked ? (
                        <Lock className="h-4 w-4 text-[#FFED00]" />
                      ) : (
                        <Unlock className="h-4 w-4 text-white/50" />
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