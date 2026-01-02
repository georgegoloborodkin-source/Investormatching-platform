import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Match, Startup, Investor, TimeSlotConfig } from "@/types";
import { Edit2, Save, X, Users, AlertCircle, CheckCircle, Lock, Unlock, Clock, Phone, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EditableScheduleProps {
  matches: Match[];
  startups: Startup[];
  investors: Investor[];
  timeSlots: TimeSlotConfig[];
  onUpdateMatch: (matchId: string, updates: Partial<Match>) => void;
  onUpdateAttendance: (type: 'startup' | 'investor', id: string, slotId: string, attending: boolean) => void;
  onUpdateTimeSlots: (slots: TimeSlotConfig[]) => void;
  onToggleCompleted: (matchId: string) => void;
  onToggleLocked: (matchId: string) => void;
}

export function EditableSchedule({ 
  matches, 
  startups, 
  investors, 
  timeSlots,
  onUpdateMatch, 
  onUpdateAttendance,
  onUpdateTimeSlots,
  onToggleCompleted,
  onToggleLocked
}: EditableScheduleProps) {
  const { toast } = useToast();
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    startupId: string;
    investorId: string;
    timeSlot: string;
  }>({ startupId: '', investorId: '', timeSlot: '' });

  // Group matches by time slots
  const groupedMatches = matches.reduce((acc, match) => {
    if (!acc[match.timeSlot]) {
      acc[match.timeSlot] = [];
    }
    acc[match.timeSlot].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  const handleStartEdit = (match: Match) => {
    setEditingMatch(match.id);
    setEditForm({
      startupId: match.startupId,
      investorId: match.investorId,
      timeSlot: match.timeSlot
    });
  };

  const handleSaveEdit = () => {
    if (!editingMatch) return;

    const startup = startups.find(s => s.id === editForm.startupId);
    const investor = investors.find(i => i.id === editForm.investorId);
    const timeSlot = timeSlots.find(ts => ts.label === editForm.timeSlot);

    if (!startup || !investor || !timeSlot) {
      toast({
        title: "Invalid Selection",
        description: "Please select valid startup, investor, and time slot.",
        variant: "destructive"
      });
      return;
    }

    onUpdateMatch(editingMatch, {
      startupId: editForm.startupId,
      investorId: editForm.investorId,
      startupName: startup.companyName,
      investorName: `${investor.firmName} (${investor.memberName})`,
      timeSlot: editForm.timeSlot,
      slotTime: `${timeSlot.startTime} - ${timeSlot.endTime}`
    });

    setEditingMatch(null);
    toast({
      title: "Match Updated",
      description: "Meeting has been successfully rescheduled.",
    });
  };

  const handleCancelEdit = () => {
    setEditingMatch(null);
    setEditForm({ startupId: '', investorId: '', timeSlot: '' });
  };

  const handleAttendanceChange = (
    type: 'startup' | 'investor',
    id: string,
    slotId: string,
    attending: boolean
  ) => {
    onUpdateAttendance(type, id, slotId, attending);
  };

  const handleToggleSlotDone = (slotId: string, isDone: boolean) => {
    const updatedSlots = timeSlots.map(slot => 
      slot.id === slotId ? { ...slot, isDone } : slot
    );
    onUpdateTimeSlots(updatedSlots);
    
    toast({
      title: isDone ? "Slot Marked as Done" : "Slot Reopened",
      description: isDone 
        ? "This slot is now locked and won't receive new assignments." 
        : "This slot is now available for new assignments.",
    });
  };

  const getAttendanceStatus = (match: Match) => {
    const startupAttending = match.startupAttending !== false;
    const investorAttending = match.investorAttending !== false;
    
    if (!startupAttending && !investorAttending) {
      return { status: 'both-absent', color: 'bg-red-100 text-red-800 border-red-200' };
    } else if (!startupAttending || !investorAttending) {
      return { status: 'partially-absent', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    } else {
      return { status: 'both-present', color: 'bg-green-100 text-green-800 border-green-200' };
    }
  };

  // Group matches by investor member for call list view
  const matchesByMember = matches.reduce((acc, match) => {
    const investor = investors.find(i => i.id === match.investorId);
    if (!investor) return acc;
    
    const memberKey = `${investor.firmName}::${investor.memberName}`;
    if (!acc[memberKey]) {
      acc[memberKey] = {
        firmName: investor.firmName,
        memberName: investor.memberName,
        matches: []
      };
    }
    acc[memberKey].matches.push(match);
    return acc;
  }, {} as Record<string, { firmName: string; memberName: string; matches: Match[] }>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Investment Team Call Schedule</h2>
          <p className="text-sm text-muted-foreground mt-1">
            View meetings by time slot. Each card shows which team member needs to call which startup.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {timeSlots.map((timeSlot) => {
          const slotMatches = groupedMatches[timeSlot.label] || [];
          
          return (
            <Card key={timeSlot.id} className="overflow-hidden border-2">
              <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2">
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span className="font-bold text-blue-900">{timeSlot.startTime} - {timeSlot.endTime}</span>
                  </div>
                  <span className="text-muted-foreground font-normal">({timeSlot.label})</span>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">Slot Done</Label>
                      <Switch
                        checked={!!timeSlot.isDone}
                        onCheckedChange={(checked) => handleToggleSlotDone(timeSlot.id, checked)}
                      />
                    </div>
                    <Badge 
                      variant={timeSlot.isDone ? "destructive" : "default"}
                      className={timeSlot.isDone ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}
                    >
                      {timeSlot.isDone ? "Completed" : `${slotMatches.length} call${slotMatches.length !== 1 ? 's' : ''}`}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {slotMatches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No meetings scheduled for this slot
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {slotMatches.map((match) => {
                    const startup = startups.find(s => s.id === match.startupId);
                    const investor = investors.find(i => i.id === match.investorId);
                    const attendanceStatus = getAttendanceStatus(match);
                    const isEditing = editingMatch === match.id;

                    return (
                      <div
                        key={match.id}
                        className={`p-4 border rounded-lg transition-all ${
                          match.completed 
                            ? 'bg-green-50 border-green-200 opacity-75' 
                            : match.locked
                            ? 'bg-orange-50 border-orange-200 border-2'
                            : 'bg-card hover:bg-accent/50'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Startup</Label>
                              <Select
                                value={editForm.startupId}
                                onValueChange={(value) => setEditForm(prev => ({ ...prev, startupId: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select startup" />
                                </SelectTrigger>
                                <SelectContent>
                                  {startups.map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.companyName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Investor</Label>
                              <Select
                                value={editForm.investorId}
                                onValueChange={(value) => setEditForm(prev => ({ ...prev, investorId: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select investor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {investors.map(i => (
                                    <SelectItem key={i.id} value={i.id}>
                                      {i.firmName} ({i.memberName})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Time Slot</Label>
                              <Select
                                value={editForm.timeSlot}
                                onValueChange={(value) => setEditForm(prev => ({ ...prev, timeSlot: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select time slot" />
                                </SelectTrigger>
                                <SelectContent>
                                  {timeSlots.map(ts => (
                                    <SelectItem key={ts.id} value={ts.label}>
                                      {ts.label} ({ts.startTime} - {ts.endTime})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveEdit}>
                                <Save className="h-4 w-4 mr-2" />
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Investment Team Member Call Info - Prominent */}
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Phone className="h-4 w-4 text-indigo-600" />
                                <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">Call Assignment</span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-semibold text-base">{investor?.memberName || 'Unknown Member'}</span>
                                </div>
                                <div className="text-sm text-muted-foreground pl-6">
                                  from <span className="font-medium">{investor?.firmName || 'Unknown Firm'}</span>
                                  {investor?.tableNumber && (
                                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                                      Table {investor.tableNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Startup to Call */}
                            <div className="bg-white p-3 rounded-lg border-2 border-primary/20">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Startup to Call</div>
                              <div className="font-bold text-lg text-primary">
                                {match.startupName}
                              </div>
                              {startup && (
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                  <div>Industry: <span className="font-medium">{startup.industry}</span></div>
                                  <div>Stage: <span className="font-medium">{startup.fundingStage}</span> • Target: <span className="font-medium">${(startup.fundingTarget / 1000000).toFixed(1)}M</span></div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-start justify-between pt-2 border-t">
                              <div className="flex gap-2 flex-wrap">
                                <Badge className={`text-xs ${attendanceStatus.color}`}>
                                  Match Score: {match.compatibilityScore}%
                                </Badge>
                                {match.locked && (
                                  <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Locked
                                  </Badge>
                                )}
                                {match.completed && (
                                  <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-200">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Completed
                                  </Badge>
                                )}
                              </div>
                              {match.scoreBreakdown && match.scoreBreakdown.length > 0 && (
                                <div className="mt-2 text-xs text-muted-foreground space-y-1 w-full">
                                  <div className="font-semibold">{match.scoreBreakdown[0]}</div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                    {match.scoreBreakdown.slice(1).map((line, idx) => (
                                      <div key={idx} className="truncate">
                                        {line}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onToggleCompleted(match.id)}
                                  className={match.completed ? "text-green-600" : ""}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onToggleLocked(match.id)}
                                  className={match.locked ? "text-orange-600" : "text-gray-400"}
                                  title={match.locked ? "Unlock match" : "Lock match"}
                                >
                                  {match.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStartEdit(match)}
                                  disabled={match.locked}
                                  className={match.locked ? "opacity-50 cursor-not-allowed" : ""}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            {/* Attendance Controls */}
                            <div className="space-y-2 pt-2 border-t border-border">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium">Startup Attending</Label>
                                <Switch
                                  checked={match.startupAttending !== false}
                                  onCheckedChange={(checked) => 
                                    handleAttendanceChange('startup', match.startupId, timeSlot.id, checked)
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium">Investor Attending</Label>
                                <Switch
                                  checked={match.investorAttending !== false}
                                  onCheckedChange={(checked) => 
                                    handleAttendanceChange('investor', match.investorId, timeSlot.id, checked)
                                  }
                                />
                              </div>
                            </div>

                            {/* Attendance Status Indicator */}
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              <Badge variant="outline" className={`text-xs ${attendanceStatus.color}`}>
                                {attendanceStatus.status === 'both-present' && 'Both attending'}
                                {attendanceStatus.status === 'partially-absent' && 'One not attending'}
                                {attendanceStatus.status === 'both-absent' && 'Both not attending'}
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                   })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}