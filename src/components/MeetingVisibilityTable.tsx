import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Startup, Investor, Match } from "@/types";
import { Users, Building2 } from "lucide-react";

interface MeetingVisibilityTableProps {
  startups: Startup[];
  investors: Investor[];
  matches: Match[];
}

export function MeetingVisibilityTable({ startups, investors, matches }: MeetingVisibilityTableProps) {
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

  // Calculate meeting counts for each investor
  const investorMeetingCounts = investors.map(investor => {
    const meetingCount = matches.filter(match => match.investorId === investor.id).length;
    const completedCount = matches.filter(match => match.investorId === investor.id && match.completed).length;
    return {
      ...investor,
      totalMeetings: meetingCount,
      completedMeetings: completedCount,
      upcomingMeetings: meetingCount - completedCount,
      slotsUsed: meetingCount,
      slotsAvailable: investor.totalSlots - meetingCount
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Startup Meetings Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Startup Meeting Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                  <TableHead className="text-center">Upcoming</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {startupMeetingCounts.map((startup) => (
                  <TableRow key={startup.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{startup.companyName}</div>
                        <div className="text-sm text-muted-foreground">{startup.industry}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{startup.totalMeetings}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                        {startup.completedMeetings}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{startup.upcomingMeetings}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Investor Meetings Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Investor Meeting Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firm</TableHead>
                  <TableHead className="text-center">Used</TableHead>
                  <TableHead className="text-center">Available</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investorMeetingCounts.map((investor) => (
                  <TableRow key={investor.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{investor.firmName}</div>
                        <div className="text-sm text-muted-foreground">
                          {investor.totalSlots} total slots
                          {investor.tableNumber && (
                            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              Table {investor.tableNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{investor.slotsUsed}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={investor.slotsAvailable > 0 ? "secondary" : "destructive"}
                      >
                        {investor.slotsAvailable}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                        {investor.completedMeetings}
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