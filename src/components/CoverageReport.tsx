import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
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

interface StartupResourceStatus {
  name: string;
  hasInvestor: boolean;
  hasMentor: boolean;
  hasCorporate: boolean;
  totalMatches: number;
}

export function CoverageReport({ startups, investors, mentors, corporates, matches }: CoverageReportProps) {
  // Count by startup name (matches are deduped by name in the allocator)
  const startupCountsByName = new Map<string, number>();
  const startupHasInvestor = new Map<string, boolean>();
  const startupHasMentor = new Map<string, boolean>();
  const startupHasCorporate = new Map<string, boolean>();
  const targetCounts = new Map<string, number>(); // targetId -> used slots

  for (const m of matches) {
    const nameKey = norm(m.startupName);
    startupCountsByName.set(nameKey, (startupCountsByName.get(nameKey) || 0) + 1);
    
    // Track which types each startup has
    const targetType = m.targetType || "investor";
    if (targetType === "investor") startupHasInvestor.set(nameKey, true);
    if (targetType === "mentor") startupHasMentor.set(nameKey, true);
    if (targetType === "corporate") startupHasCorporate.set(nameKey, true);
    
    const tid = m.targetId || m.investorId;
    if (tid) {
      targetCounts.set(tid, (targetCounts.get(tid) || 0) + 1);
    }
  }

  // Check if we have any of each resource type available
  const hasInvestorsAvailable = investors.some(i => i.availabilityStatus === "present" && i.totalSlots > 0);
  const hasMentorsAvailable = mentors.some(m => m.availabilityStatus === "present" && m.totalSlots > 0);
  const hasCorporatesAvailable = corporates.some(c => c.availabilityStatus === "present" && c.totalSlots > 0);

  // Build per-startup resource status
  const seenNames = new Set<string>();
  const startupsWithZero: string[] = [];
  const startupStatuses: StartupResourceStatus[] = [];
  
  for (const s of startups) {
    if (s.availabilityStatus !== "present") continue;
    const key = norm(s.companyName);
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    
    const count = startupCountsByName.get(key) || 0;
    if (count === 0) startupsWithZero.push(s.companyName);
    
    startupStatuses.push({
      name: s.companyName,
      hasInvestor: startupHasInvestor.get(key) || false,
      hasMentor: startupHasMentor.get(key) || false,
      hasCorporate: startupHasCorporate.get(key) || false,
      totalMatches: count,
    });
  }

  // Count startups missing each type (only if that type is available)
  const startupsNoInvestor = hasInvestorsAvailable ? startupStatuses.filter(s => !s.hasInvestor).length : 0;
  const startupsNoMentor = hasMentorsAvailable ? startupStatuses.filter(s => !s.hasMentor).length : 0;
  const startupsNoCorporate = hasCorporatesAvailable ? startupStatuses.filter(s => !s.hasCorporate).length : 0;

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
          {hasInvestorsAvailable && (
            <Badge variant={startupsNoInvestor === 0 ? "secondary" : "outline"}>
              {startupsNoInvestor} without investor
            </Badge>
          )}
          {hasMentorsAvailable && (
            <Badge variant={startupsNoMentor === 0 ? "secondary" : "outline"}>
              {startupsNoMentor} without mentor
            </Badge>
          )}
          {hasCorporatesAvailable && (
            <Badge variant={startupsNoCorporate === 0 ? "secondary" : "outline"}>
              {startupsNoCorporate} without corporate
            </Badge>
          )}
        </div>

        {/* Per-startup resource breakdown */}
        <div className="space-y-2">
          <div className="font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Resource Coverage by Startup
          </div>
          <div className="grid gap-2">
            {startupStatuses.map((s) => (
              <div key={s.name} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <span className="font-medium text-sm">{s.name}</span>
                <div className="flex items-center gap-3">
                  {hasInvestorsAvailable && (
                    <div className="flex items-center gap-1 text-xs">
                      {s.hasInvestor ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={s.hasInvestor ? "text-green-600" : "text-red-600"}>Investor</span>
                    </div>
                  )}
                  {hasMentorsAvailable && (
                    <div className="flex items-center gap-1 text-xs">
                      {s.hasMentor ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={s.hasMentor ? "text-green-600" : "text-muted-foreground"}>Mentor</span>
                    </div>
                  )}
                  {hasCorporatesAvailable && (
                    <div className="flex items-center gap-1 text-xs">
                      {s.hasCorporate ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={s.hasCorporate ? "text-green-600" : "text-muted-foreground"}>Corporate</span>
                    </div>
                  )}
                  <Badge variant="outline" className="ml-2">{s.totalMatches} total</Badge>
                </div>
              </div>
            ))}
          </div>
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


