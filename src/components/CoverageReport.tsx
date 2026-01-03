import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Investor, Match, Startup } from "@/types";

interface CoverageReportProps {
  startups: Startup[];
  investors: Investor[];
  matches: Match[];
}

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

export function CoverageReport({ startups, investors, matches }: CoverageReportProps) {
  // Count by startup name (matches are deduped by name in the allocator)
  const startupCountsByName = new Map<string, number>();
  const investorCounts = new Map<string, number>();

  for (const m of matches) {
    const nameKey = norm(m.startupName);
    startupCountsByName.set(nameKey, (startupCountsByName.get(nameKey) || 0) + 1);
    investorCounts.set(m.investorId, (investorCounts.get(m.investorId) || 0) + 1);
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
      const used = investorCounts.get(i.id) || 0;
      return {
        label: `${i.firmName} (${i.memberName})`,
        unused: Math.max(0, i.totalSlots - used),
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
          <Badge variant="secondary">{investorsWithUnusedSlots.length} investors with unused slots</Badge>
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
      </CardContent>
    </Card>
  );
}


