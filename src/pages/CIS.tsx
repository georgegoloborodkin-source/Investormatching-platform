import { useMemo, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  FileText,
  ClipboardList,
  Upload,
  Loader2,
  Download,
  Trash2,
  TrendingUp,
  Users,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Sparkles,
} from "lucide-react";
import {
  extractWithClaude,
  saveDecision,
  loadDecisions,
  deleteDecision,
  calculateDecisionStats,
  exportDecisionsToCSV,
  type DealMemo,
  type Decision,
  type ExtractionResult,
} from "@/utils/claudeConverter";

// ============================================================================
// TYPES
// ============================================================================

type ScopeItem = { id: string; label: string; checked: boolean; type: "portfolio" | "deal" | "thread" | "global" };
type Message = { id: string; author: "user" | "assistant"; text: string; threadId: string };
type Thread = { id: string; title: string; parentId?: string };
type KnowledgeObject = {
  id: string;
  type: "Company" | "Person" | "Risk" | "Decision" | "Outcome";
  title: string;
  text: string;
  source: string;
  linked: string[];
};

// ============================================================================
// INITIAL DATA
// ============================================================================

const initialScopes: ScopeItem[] = [
  { id: "portfolio", label: "Portfolio Companies", checked: true, type: "portfolio" },
  { id: "deal-d", label: "DD — Company D", checked: true, type: "deal" },
  { id: "threads", label: "Saved Threads", checked: false, type: "thread" },
  { id: "historical", label: "All historical", checked: false, type: "global" },
];

const initialThreads: Thread[] = [
  { id: "t1", title: "Main: Company D red flags" },
  { id: "t2", title: "Branch: Compare with Company A", parentId: "t1" },
  { id: "t3", title: "Branch: Financial Risks", parentId: "t1" },
];

const initialMessages: Message[] = [
  { id: "m1", author: "user", text: "What are the main red flags for Company D?", threadId: "t1" },
  { id: "m2", author: "assistant", text: "Known risks: weak CFO signals; GTM unclear; burn high vs. pipeline.", threadId: "t1" },
  { id: "m3", author: "assistant", text: "Past cases similar: Company A (cash crunch), Company C (late GTM fit).", threadId: "t2" },
  { id: "m4", author: "assistant", text: "Financial: burn 450k/mo; runway 9m; pipeline coverage 0.8x.", threadId: "t3" },
];

const initialKOs: KnowledgeObject[] = [
  {
    id: "ko1",
    type: "Risk",
    title: "Weak CFO bench",
    text: "CFO org is thin; missed close last quarter.",
    source: "DD Memo (2023-08)",
    linked: ["Company A", "Company C"],
  },
  {
    id: "ko2",
    type: "Decision",
    title: "Conditioned term sheet",
    text: "Proceed if CFO hired + GTM plan validated within 60 days.",
    source: "IC Notes (2024-01)",
    linked: ["Outcome: GTM delay"],
  },
  {
    id: "ko3",
    type: "Outcome",
    title: "Cash crunch in 12m",
    text: "Similar pattern led to cash issues at Company A within 12 months.",
    source: "Portfolio Post-mortem",
    linked: ["Company A"],
  },
];

// ============================================================================
// THREAD TREE COMPONENT
// ============================================================================

function ThreadTree({ threads, active, onSelect }: { threads: Thread[]; active: string; onSelect: (id: string) => void }) {
  const renderThread = (t: Thread, level = 0) => {
    return (
      <div
        key={t.id}
        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${
          active === t.id ? "bg-muted border-l-2 border-primary" : ""
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
        onClick={() => onSelect(t.id)}
      >
        <span className="text-xs text-muted-foreground font-mono">
          {level === 0 ? "▸" : "└"}
        </span>
        <span className={`text-sm ${active === t.id ? "font-semibold" : ""}`}>{t.title}</span>
      </div>
    );
  };
  const root = threads.filter((t) => !t.parentId);
  const children = (id: string) => threads.filter((t) => t.parentId === id);
  const walk = (t: Thread, level: number): JSX.Element[] => {
    const arr = [renderThread(t, level)];
    children(t.id).forEach((c) => arr.push(...walk(c, level + 1)));
    return arr;
  };
  return <div className="space-y-1">{root.flatMap((t) => walk(t, 0))}</div>;
}

// ============================================================================
// DOCUMENT CONVERTER TAB
// ============================================================================

function DocumentConverterTab() {
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For now, only handle text files. PDF extraction would need additional library
    if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const text = await file.text();
      setDocumentText(text);
      toast({ title: "File loaded", description: `Loaded ${file.name} (${text.length} characters)` });
    } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      toast({
        title: "PDF Support",
        description: "For PDF extraction, paste the text content or use the backend PDF parser.",
        variant: "default",
      });
    } else {
      toast({
        title: "Unsupported file",
        description: "Please upload a .txt, .md, or paste text directly",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleExtract = useCallback(async () => {
    if (!documentText.trim()) {
      toast({ title: "No content", description: "Please paste or upload document text", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const extractionResult = await extractWithClaude(documentText, apiKey || undefined);
      setResult(extractionResult);
      
      if (extractionResult.success) {
        toast({
          title: "Extraction complete",
          description: `Extracted data with ${extractionResult.data?.rawConfidence || 0}% confidence`,
        });
      } else {
        toast({
          title: "Extraction failed",
          description: extractionResult.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Extraction failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [documentText, apiKey, toast]);

  const downloadJSON = useCallback(() => {
    if (!result?.data) return;
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deal-memo-${result.data.company.name || "unknown"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Document Input
            </CardTitle>
            <CardDescription>
              Paste pitch deck text or upload a document for AI extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="api-key">Claude API Key (optional for demo)</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-ant-api..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Without API key, uses demo mode with mock data
              </p>
            </div>

            <div>
              <Label>Upload File</Label>
              <Input
                type="file"
                accept=".txt,.md,.pdf"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
            </div>

            <div>
              <Label htmlFor="doc-text">Document Text</Label>
              <Textarea
                id="doc-text"
                placeholder="Paste pitch deck content, investment memo, or any company document here..."
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {documentText.length} characters (~{Math.ceil(documentText.length / 4)} tokens)
              </p>
            </div>

            <Button
              onClick={handleExtract}
              disabled={isLoading || !documentText.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting with Claude...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract Deal Info
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Cost Info */}
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Cost Transparency</p>
                <p className="text-muted-foreground">
                  Claude 3.5 Sonnet: ~$0.009 per 15-page deck<br/>
                  500 decks/month = ~$4.50 total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Results */}
      <div className="space-y-4">
        {result ? (
          <>
            <Card className={result.success ? "border-green-500/50" : "border-red-500/50"}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    Extraction Result
                  </span>
                  {result.success && (
                    <Button size="sm" variant="outline" onClick={downloadJSON}>
                      <Download className="h-4 w-4 mr-1" />
                      JSON
                    </Button>
                  )}
                </CardTitle>
                {result.costEstimate && (
                  <CardDescription>Cost: {result.costEstimate}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {result.success && result.data ? (
                  <div className="space-y-4">
                    {/* Company Overview */}
                    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg">{result.data.company.name}</h3>
                        <Badge variant="outline">{result.data.company.stage}</Badge>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge>{result.data.company.sector}</Badge>
                        <Badge variant="secondary">{result.data.company.location}</Badge>
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Confidence:</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${result.data.rawConfidence}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{result.data.rawConfidence}%</span>
                    </div>

                    {/* Highlights & Red Flags */}
                    {result.data.highlights.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-green-600 mb-1">✓ Highlights</h4>
                        <ul className="text-sm space-y-1">
                          {result.data.highlights.map((h, i) => (
                            <li key={i} className="text-muted-foreground">• {h}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.data.redFlags.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-600 mb-1">⚠ Red Flags</h4>
                        <ul className="text-sm space-y-1">
                          {result.data.redFlags.map((r, i) => (
                            <li key={i} className="text-muted-foreground">• {r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Risks */}
                    {result.data.risks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Identified Risks</h4>
                        <div className="space-y-2">
                          {result.data.risks.map((risk, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <Badge
                                variant={
                                  risk.severity === "high" ? "destructive" :
                                  risk.severity === "medium" ? "default" : "secondary"
                                }
                                className="text-xs"
                              >
                                {risk.severity}
                              </Badge>
                              <div>
                                <span className="font-medium">{risk.category}:</span>{" "}
                                <span className="text-muted-foreground">{risk.description}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full JSON */}
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View full JSON
                      </summary>
                      <pre className="mt-2 p-3 bg-muted rounded-lg overflow-auto max-h-[300px] text-xs">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <div className="text-red-600 text-sm">
                    Error: {result.error}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="h-full min-h-[400px] flex items-center justify-center">
            <CardContent className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Paste document text and click Extract</p>
              <p className="text-sm mt-2">Results will appear here</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DECISION LOGGER TAB
// ============================================================================

function DecisionLoggerTab() {
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<Decision[]>(() => loadDecisions());
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [actor, setActor] = useState("");
  const [actionType, setActionType] = useState<Decision["actionType"]>("meeting");
  const [startupName, setStartupName] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [geo, setGeo] = useState("");
  const [confidence, setConfidence] = useState([70]);
  const [notes, setNotes] = useState("");

  const stats = useMemo(() => calculateDecisionStats(decisions), [decisions]);

  const handleSaveDecision = useCallback(() => {
    if (!actor.trim() || !startupName.trim()) {
      toast({ title: "Missing fields", description: "Actor and Startup name are required", variant: "destructive" });
      return;
    }

    const newDecision = saveDecision({
      actor: actor.trim(),
      actionType,
      startupName: startupName.trim(),
      context: {
        sector: sector.trim() || undefined,
        stage: stage.trim() || undefined,
        geo: geo.trim() || undefined,
      },
      confidenceScore: confidence[0],
      outcome: "pending",
      notes: notes.trim() || undefined,
    });

    setDecisions(prev => [...prev, newDecision]);
    toast({ title: "Decision logged", description: `Logged ${actionType} for ${startupName}` });

    // Reset form
    setActor("");
    setStartupName("");
    setSector("");
    setStage("");
    setGeo("");
    setConfidence([70]);
    setNotes("");
    setShowForm(false);
  }, [actor, actionType, startupName, sector, stage, geo, confidence, notes, toast]);

  const handleDeleteDecision = useCallback((id: string) => {
    deleteDecision(id);
    setDecisions(prev => prev.filter(d => d.id !== id));
    toast({ title: "Deleted", description: "Decision removed" });
  }, [toast]);

  const handleUpdateOutcome = useCallback((id: string, outcome: Decision["outcome"]) => {
    const updated = decisions.map(d => 
      d.id === id ? { ...d, outcome } : d
    );
    localStorage.setItem("cis_decisions", JSON.stringify(updated));
    setDecisions(updated);
  }, [decisions]);

  const handleExport = useCallback(() => {
    const csv = exportDecisionsToCSV(decisions);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `decisions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `Downloaded ${decisions.length} decisions as CSV` });
  }, [decisions, toast]);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDecisions}</p>
                <p className="text-xs text-muted-foreground">Total Decisions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.averageConfidence}%</p>
                <p className="text-xs text-muted-foreground">Avg Confidence</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.byOutcome.positive || 0}</p>
                <p className="text-xs text-muted-foreground">Positive Outcomes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.topActors.length}</p>
                <p className="text-xs text-muted-foreground">Active Actors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Log New Decision"}
        </Button>
        {decisions.length > 0 && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        )}
      </div>

      {/* New Decision Form */}
      {showForm && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>Log New Decision</CardTitle>
            <CardDescription>Record a decision for pattern analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Actor (Who made the decision) *</Label>
                <Input
                  placeholder="e.g., Partner A, John Smith"
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                />
              </div>
              <div>
                <Label>Action Type *</Label>
                <Select value={actionType} onValueChange={(v) => setActionType(v as Decision["actionType"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intro">Intro</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="due_diligence">Due Diligence</SelectItem>
                    <SelectItem value="pass">Pass</SelectItem>
                    <SelectItem value="invest">Invest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Startup Name *</Label>
                <Input
                  placeholder="e.g., Company X"
                  value={startupName}
                  onChange={(e) => setStartupName(e.target.value)}
                />
              </div>
              <div>
                <Label>Sector</Label>
                <Input
                  placeholder="e.g., FinTech, HealthTech"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                />
              </div>
              <div>
                <Label>Stage</Label>
                <Input
                  placeholder="e.g., Seed, Series A"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                />
              </div>
              <div>
                <Label>Geography</Label>
                <Input
                  placeholder="e.g., Singapore, Indonesia"
                  value={geo}
                  onChange={(e) => setGeo(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Confidence Score: {confidence[0]}%</Label>
              <Slider
                value={confidence}
                onValueChange={setConfidence}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                How confident are you in this decision?
              </p>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional context or reasoning..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button onClick={handleSaveDecision} className="w-full">
              Save Decision
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Decision History */}
      <Card>
        <CardHeader>
          <CardTitle>Decision History</CardTitle>
          <CardDescription>
            {decisions.length} decisions logged • Click outcome to update
          </CardDescription>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No decisions logged yet</p>
              <p className="text-sm">Start logging decisions to build your pattern database</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-auto">
              {decisions.slice().reverse().map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {d.actionType}
                    </Badge>
                    <div>
                      <p className="font-medium">{d.startupName}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.actor} • {new Date(d.timestamp).toLocaleDateString()}
                        {d.context.sector && ` • ${d.context.sector}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{d.confidenceScore}%</span>
                    <Select
                      value={d.outcome || "pending"}
                      onValueChange={(v) => handleUpdateOutcome(d.id, v as Decision["outcome"])}
                    >
                      <SelectTrigger className="w-[100px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        </SelectItem>
                        <SelectItem value="positive">
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" /> Positive
                          </span>
                        </SelectItem>
                        <SelectItem value="negative">
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertTriangle className="h-3 w-3" /> Negative
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteDecision(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Actors */}
      {stats.topActors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Decision Makers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topActors.map((a, i) => (
                <div key={a.actor} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">#{i + 1}</span>
                    <span className="font-medium">{a.actor}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span>{a.count} decisions</span>
                    <Badge variant={a.winRate > 50 ? "default" : "secondary"}>
                      {a.winRate}% win rate
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// MAIN CIS COMPONENT
// ============================================================================

export default function CIS() {
  const [scopes, setScopes] = useState<ScopeItem[]>(initialScopes);
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [activeThread, setActiveThread] = useState<string>("t1");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat");

  const scopedMessages = useMemo(() => messages.filter((m) => m.threadId === activeThread), [messages, activeThread]);

  const addMessage = () => {
    if (!input.trim()) return;
    const id = `m-${Date.now()}`;
    setMessages((prev) => [...prev, { id, author: "user", text: input.trim(), threadId: activeThread }]);
    setInput("");
  };

  const createBranch = (title: string) => {
    const id = `t-${Date.now()}`;
    setThreads((prev) => [...prev, { id, title, parentId: activeThread }]);
    setActiveThread(id);
  };

  const toggleScope = (id: string, checked: boolean) => {
    setScopes((prev) => prev.map((s) => (s.id === id ? { ...s, checked } : s)));
  };

  const evidence = initialKOs;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              Company Intelligence System
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-powered document extraction, decision tracking, and knowledge management
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/">← Back to Matchmaking</a>
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Intelligence Chat
            </TabsTrigger>
            <TabsTrigger value="converter" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document Converter
            </TabsTrigger>
            <TabsTrigger value="decisions" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Decision Logger
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Scope applied:{" "}
              {scopes
                .filter((s) => s.checked)
                .map((s) => s.label)
                .join(", ") || "None"}
            </div>

            <div className="grid grid-cols-12 gap-4">
              {/* Left: Scope */}
              <div className="col-span-12 lg:col-span-3 space-y-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Knowledge Scope</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {scopes.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm border px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox checked={s.checked} onCheckedChange={(val) => toggleScope(s.id, val === true)} />
                        <span className="flex-1">{s.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {s.type}
                        </Badge>
                      </label>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Threads (Branching)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ThreadTree threads={threads} active={activeThread} onSelect={setActiveThread} />
                    <Button size="sm" variant="outline" onClick={() => createBranch("New branch")} className="w-full">
                      + New branch
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Center: Chat */}
              <div className="col-span-12 lg:col-span-6 space-y-3">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Branching Chat</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border rounded-md p-3 h-[420px] overflow-auto space-y-3 bg-muted/20">
                      {scopedMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`p-3 rounded-md border ${
                            m.author === "user" ? "bg-primary/10 border-primary/30" : "bg-card"
                          }`}
                        >
                          <div className="text-xs text-muted-foreground mb-1 uppercase">{m.author}</div>
                          <div className="text-sm leading-relaxed">{m.text}</div>
                          {m.author === "assistant" && (
                            <div className="mt-2">
                              <Button size="sm" variant="secondary" onClick={() => createBranch("Branch: follow-up")}>
                                Branch
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question or continue the branch..."
                        className="min-h-[80px]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            addMessage();
                          }
                        }}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Ctrl+Enter to send</span>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => createBranch("What-if branch")}>
                            New Branch
                          </Button>
                          <Button onClick={addMessage}>Send</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: Evidence */}
              <div className="col-span-12 lg:col-span-3 space-y-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Memory & Evidence</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {evidence.map((ko) => (
                      <div key={ko.id} className="border rounded-md p-3 space-y-1 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Badge variant={ko.type === "Risk" ? "destructive" : ko.type === "Outcome" ? "default" : "secondary"}>
                            {ko.type}
                          </Badge>
                          <div className="font-medium text-sm">{ko.title}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{ko.text}</div>
                        <div className="text-xs text-muted-foreground">
                          Source: <span className="font-medium">{ko.source}</span>
                        </div>
                        {ko.linked.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Linked: {ko.linked.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 text-sm text-muted-foreground space-y-2">
                    <div className="text-xs">
                      <strong>Tips:</strong>
                      <ul className="list-disc list-inside space-y-1 mt-1">
                        <li>Branch to explore alternatives</li>
                        <li>Untick scope to exclude sources</li>
                        <li>Evidence shows Knowledge Objects</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Converter Tab */}
          <TabsContent value="converter">
            <DocumentConverterTab />
          </TabsContent>

          {/* Decisions Tab */}
          <TabsContent value="decisions">
            <DecisionLoggerTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
