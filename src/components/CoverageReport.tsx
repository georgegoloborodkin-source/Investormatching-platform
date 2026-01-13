import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Investor, Match, Startup, Mentor, CorporatePartner } from "@/types";

interface CoverageReportProps {
  startups: Startup[];
  investors: Investor[];
  mentors: Mentor[];
  corporates: CorporatePartner[];
  matches: Match[];
}

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

export function CoverageReport({ startups, investors, mentors, corporates, matches }: CoverageReportProps) {
  // Count by startup name (matches are deduped by name in the allocator)
  const startupCountsByName = new Map<string, number>();
  const targetCounts = new Map<string, number>(); // targetId -> used slots

  for (const m of matches) {
    const nameKey = norm(m.startupName);
    startupCountsByName.set(nameKey, (startupCountsByName.get(nameKey) || 0) + 1);
    const tid = m.targetId || m.investorId;
    if (tid) {
      targetCounts.set(tid, (targetCounts.get(tid) || 0) + 1);
    }
  }

  // Unique present startups by name to avoid double-reporting same company with different IDs
  const seenNames = new Set<string>();
  const startupsWithZero: string[] = [];
  for (const s of startups) {
    if (s.availabilityStatus !== "present") continue;
    const key = norm(s.companyName);
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    const count = startupCountsByName.get(key) || 0;
    if (count === 0) startupsWithZero.push(s.companyName);
  }

  const investorsWithUnusedSlots = investors
    .filter((i) => i.availabilityStatus === "present")
    .map((i) => {
      const used = targetCounts.get(i.id) || 0;
      return {
        label: `${i.firmName} (${i.memberName})`,
        unused: Math.max(0, i.totalSlots - used),
      };
    })
    .filter((x) => x.unused > 0)
    .sort((a, b) => b.unused - a.unused);

  const mentorsWithUnusedSlots = mentors
    .filter((m) => m.availabilityStatus === "present")
    .map((m) => {
      const used = targetCounts.get(m.id) || 0;
      return {
        label: m.fullName,
        unused: Math.max(0, m.totalSlots - used),
      };
    })
    .filter((x) => x.unused > 0)
    .sort((a, b) => b.unused - a.unused);

  const corporatesWithUnusedSlots = corporates
    .filter((c) => c.availabilityStatus === "present")
    .map((c) => {
      const used = targetCounts.get(c.id) || 0;
      return {
        label: `${c.firmName} (${c.contactName})`,
        unused: Math.max(0, c.totalSlots - used),
      };
    })
    .filter((x) => x.unused > 0)
    .sort((a, b) => b.unused - a.unused);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{matches.length} matches</Badge>
          <Badge variant={startupsWithZero.length === 0 ? "secondary" : "destructive"}>
            {startupsWithZero.length} startups with 0 meetings
          </Badge>
          <Badge variant="secondary">
            {investorsWithUnusedSlots.length} investors with unused slots
          </Badge>
          <Badge variant="secondary">
            {mentorsWithUnusedSlots.length} mentors with unused slots
          </Badge>
          <Badge variant="secondary">
            {corporatesWithUnusedSlots.length} corporates with unused slots
          </Badge>
        </div>

        {startupsWithZero.length > 0 && (
          <div className="space-y-1">
            <div className="font-medium">Startups with 0 meetings</div>
            <div className="text-sm text-muted-foreground">
              {startupsWithZero.join(", ")}
            </div>
          </div>
        )}

        {investorsWithUnusedSlots.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium">Unused investor slots</div>
            <div className="space-y-1">
              {investorsWithUnusedSlots.slice(0, 8).map((x) => (
                <div key={x.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{x.label}</span>
                  <Badge variant="outline">{x.unused} unused</Badge>
                </div>
              ))}
              {investorsWithUnusedSlots.length > 8 && (
                <div className="text-xs text-muted-foreground">
                  +{investorsWithUnusedSlots.length - 8} more…
                </div>
              )}
            </div>
          </div>
        )}

        {mentorsWithUnusedSlots.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium">Unused mentor slots</div>
            <div className="space-y-1">
              {mentorsWithUnusedSlots.slice(0, 8).map((x) => (
                <div key={x.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{x.label}</span>
                  <Badge variant="outline">{x.unused} unused</Badge>
                </div>
              ))}
              {mentorsWithUnusedSlots.length > 8 && (
                <div className="text-xs text-muted-foreground">
                  +{mentorsWithUnusedSlots.length - 8} more…
                </div>
              )}
            </div>
          </div>
        )}

        {corporatesWithUnusedSlots.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium">Unused corporate slots</div>
            <div className="space-y-1">
              {corporatesWithUnusedSlots.slice(0, 8).map((x) => (
                <div key={x.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{x.label}</span>
                  <Badge variant="outline">{x.unused} unused</Badge>
                </div>
              ))}
              {corporatesWithUnusedSlots.length > 8 && (
                <div className="text-xs text-muted-foreground">
                  +{corporatesWithUnusedSlots.length - 8} more…
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


