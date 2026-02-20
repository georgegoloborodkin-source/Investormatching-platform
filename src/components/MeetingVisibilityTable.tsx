import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Startup, Investor, Match, Mentor, CorporatePartner } from "@/types";
import { Users, Building2, GraduationCap, BriefcaseBusiness } from "lucide-react";

interface MeetingVisibilityTableProps {
  startups: Startup[];
  investors: Investor[];
  mentors: Mentor[];
  corporates: CorporatePartner[];
  matches: Match[];
}

export function MeetingVisibilityTable({ startups, investors, mentors, corporates, matches }: MeetingVisibilityTableProps) {
  // Calculate meeting counts for each startup
  const startupMeetingCounts = startups.map(startup => {
    const meetingCount = matches.filter(match => match.startupId === startup.id).length;
    const completedCount = matches.filter(match => match.startupId === startup.id && match.completed).length;
    return {
      ...startup,
      totalMeetings: meetingCount,
      completedMeetings: completedCount,
      upcomingMeetings: meetingCount - completedCount
    };
  });

  // Helper to get target meetings by id
  const meetingsForTarget = (id: string) => matches.filter(m => (m.targetId || m.investorId) === id);

  const investorMeetingCounts = investors.map(investor => {
    const list = meetingsForTarget(investor.id);
    const completedCount = list.filter(m => m.completed).length;
    const meetingCount = list.length;
    return {
      ...investor,
      totalMeetings: meetingCount,
      completedMeetings: completedCount,
      upcomingMeetings: meetingCount - completedCount,
      slotsUsed: meetingCount,
      slotsAvailable: investor.totalSlots - meetingCount
    };
  });

  const mentorMeetingCounts = mentors.map(mentor => {
    const list = meetingsForTarget(mentor.id);
    const completedCount = list.filter(m => m.completed).length;
    const meetingCount = list.length;
    return {
      ...mentor,
      totalMeetings: meetingCount,
      completedMeetings: completedCount,
      upcomingMeetings: meetingCount - completedCount,
      slotsUsed: meetingCount,
      slotsAvailable: mentor.totalSlots - meetingCount
    };
  });

  const corporateMeetingCounts = corporates.map(corp => {
    const list = meetingsForTarget(corp.id);
    const completedCount = list.filter(m => m.completed).length;
    const meetingCount = list.length;
    return {
      ...corp,
      totalMeetings: meetingCount,
      completedMeetings: completedCount,
      upcomingMeetings: meetingCount - completedCount,
      slotsUsed: meetingCount,
      slotsAvailable: corp.totalSlots - meetingCount
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Startup Meetings Overview */}
        <Card className="border-2 border-slate-200 bg-transparent">
          <CardHeader className="border-b-2 border-slate-200">
            <CardTitle className="flex items-center gap-2 text-slate-900 font-mono font-black uppercase tracking-tight">
              <Building2 className="h-5 w-5 text-[#3b82f6]" />
              Startup Meeting Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-900">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-slate-200 hover:bg-transparent">
                  <TableHead className="text-slate-900 font-mono font-bold">Company</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Total</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Completed</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Upcoming</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {startupMeetingCounts.map((startup) => (
                  <TableRow key={startup.id} className="border-b border-slate-200/30 hover:bg-[#3b82f6]/5">
                    <TableCell className="text-slate-900">
                      <div>
                        <div className="font-mono font-bold">{startup.companyName}</div>
                        <div className="text-sm text-slate-500 font-mono">{startup.industry}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-slate-200 text-slate-900 bg-transparent font-mono">{startup.totalMeetings}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-[#3b82f6] text-[#3b82f6] bg-transparent font-mono">
                        {startup.completedMeetings}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-slate-200 text-slate-900 bg-transparent font-mono">{startup.upcomingMeetings}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Investor Meetings Overview */}
        <Card className="border-2 border-slate-200 bg-transparent">
          <CardHeader className="border-b-2 border-slate-200">
            <CardTitle className="flex items-center gap-2 text-slate-900 font-mono font-black uppercase tracking-tight">
              <Users className="h-5 w-5 text-[#3b82f6]" />
              Investor Meeting Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-900">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-slate-200 hover:bg-transparent">
                  <TableHead className="text-slate-900 font-mono font-bold">Firm</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Used</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Available</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investorMeetingCounts.map((investor) => (
                  <TableRow key={investor.id} className="border-b border-slate-200/30 hover:bg-[#3b82f6]/5">
                    <TableCell className="text-slate-900">
                      <div>
                        <div className="font-mono font-bold">{investor.firmName}</div>
                        <div className="text-sm text-slate-500 font-mono">
                          Investment member: {investor.memberName}
                        </div>
                        <div className="text-sm text-slate-500 font-mono">
                          {investor.totalSlots} total slots
                          {investor.tableNumber && (
                            <span className="ml-2 px-1.5 py-0.5 border border-[#3b82f6] text-[#3b82f6] bg-transparent text-xs rounded font-mono">
                              Table {investor.tableNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-slate-200 text-slate-900 bg-transparent font-mono">{investor.slotsUsed}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={investor.slotsAvailable > 0 ? "border-[#3b82f6] text-[#3b82f6] bg-transparent font-mono" : "border-slate-200/50 text-slate-400 bg-transparent font-mono"}>
                        {investor.slotsAvailable}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-[#3b82f6] text-[#3b82f6] bg-transparent font-mono">
                        {investor.completedMeetings}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Mentor Meetings Overview */}
        <Card className="border-2 border-slate-200 bg-transparent">
          <CardHeader className="border-b-2 border-slate-200">
            <CardTitle className="flex items-center gap-2 text-slate-900 font-mono font-black uppercase tracking-tight">
              <GraduationCap className="h-5 w-5 text-[#3b82f6]" />
              Mentor Meeting Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-900">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-slate-200 hover:bg-transparent">
                  <TableHead className="text-slate-900 font-mono font-bold">Mentor</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Used</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Available</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mentorMeetingCounts.map((mentor) => (
                  <TableRow key={mentor.id} className="border-b border-slate-200/30 hover:bg-[#3b82f6]/5">
                    <TableCell className="text-slate-900">
                      <div>
                        <div className="font-mono font-bold">{mentor.fullName}</div>
                        <div className="text-sm text-slate-500 font-mono">
                          {mentor.totalSlots} total slots
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-slate-200 text-slate-900 bg-transparent font-mono">{mentor.slotsUsed}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={mentor.slotsAvailable > 0 ? "border-[#3b82f6] text-[#3b82f6] bg-transparent font-mono" : "border-slate-200/50 text-slate-400 bg-transparent font-mono"}>
                        {mentor.slotsAvailable}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-[#3b82f6] text-[#3b82f6] bg-transparent font-mono">
                        {mentor.completedMeetings}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Corporate Meetings Overview */}
        <Card className="border-2 border-slate-200 bg-transparent">
          <CardHeader className="border-b-2 border-slate-200">
            <CardTitle className="flex items-center gap-2 text-slate-900 font-mono font-black uppercase tracking-tight">
              <BriefcaseBusiness className="h-5 w-5 text-[#3b82f6]" />
              Corporate Meeting Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="text-slate-900">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-slate-200 hover:bg-transparent">
                  <TableHead className="text-slate-900 font-mono font-bold">Corporate</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Used</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Available</TableHead>
                  <TableHead className="text-center text-slate-900 font-mono font-bold">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corporateMeetingCounts.map((corp) => (
                  <TableRow key={corp.id} className="border-b border-slate-200/30 hover:bg-[#3b82f6]/5">
                    <TableCell className="text-slate-900">
                      <div>
                        <div className="font-mono font-bold">{corp.firmName}</div>
                        <div className="text-sm text-slate-500 font-mono">
                          Contact: {corp.contactName}
                        </div>
                        <div className="text-sm text-slate-500 font-mono">
                          {corp.totalSlots} total slots
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-slate-200 text-slate-900 bg-transparent font-mono">{corp.slotsUsed}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={corp.slotsAvailable > 0 ? "border-[#3b82f6] text-[#3b82f6] bg-transparent font-mono" : "border-slate-200/50 text-slate-400 bg-transparent font-mono"}>
                        {corp.slotsAvailable}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-[#3b82f6] text-[#3b82f6] bg-transparent font-mono">
                        {corp.completedMeetings}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}