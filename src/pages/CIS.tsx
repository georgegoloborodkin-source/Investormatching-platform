import { useMemo, useState, useCallback, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
  Folder,
  Link2,
} from "lucide-react";
import {
  calculateDecisionStats,
  exportDecisionsToCSV,
  type Decision,
} from "@/utils/claudeConverter";
import type { DocumentRecord, SourceRecord } from "@/types";
import {
  ensureActiveEventForOrg,
  ensureOrganizationForUser,
  getDecisionsByEvent,
  getDocumentsByEvent,
  getSourcesByEvent,
  insertDecision,
  insertDocument,
  insertSource,
  updateDecision,
  deleteDecision,
  deleteSource,
  getDocumentById,
} from "@/utils/supabaseHelpers";
import { convertFileWithAI, convertWithAI, type AIConversionResponse } from "@/utils/aiConverter";
import { ingestClickUpList, ingestGoogleDrive } from "@/utils/ingestionClient";
import { supabase } from "@/integrations/supabase/client";

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

const initialThreads: Thread[] = [];
const initialMessages: Message[] = [];
const initialKOs: KnowledgeObject[] = [];

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

function mapDecisionRow(row: any): Decision {
  return {
    id: row.id,
    timestamp: row.created_at,
    actor: row.actor_name,
    actionType: row.action_type,
    startupName: row.startup_name,
    context: row.context || {},
    confidenceScore: row.confidence_score ?? 0,
    outcome: row.outcome ?? undefined,
    notes: row.notes ?? undefined,
    documentId: row.document_id ?? undefined,
  };
}

// ============================================================================
// DOCUMENT CONVERTER TAB
// ============================================================================

function DocumentConverterTab({
  onDecisionDraft,
  onOpenDecisionLog,
  onAutoLogDecision,
}: {
  onDecisionDraft: (draft: { startupName: string; sector?: string; stage?: string }) => void;
  onOpenDecisionLog: () => void;
  onAutoLogDecision: (input: {
    draft: { startupName: string; sector?: string; stage?: string };
    conversion: AIConversionResponse;
    sourceType: "upload" | "paste" | "api";
    fileName: string | null;
    file: File | null;
    rawContent?: string | null;
    eventIdOverride?: string | null;
  }) => Promise<void>;
}) {
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIConversionResponse | null>(null);
  const MAX_PASTE_CHARS = 24000;

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setResult(null);
    try {
      const conversion = await convertFileWithAI(file);
      setResult(conversion);
      toast({ title: "Conversion complete", description: `Detected ${conversion.detectedType || "data"}` });

      const draft = conversion.startups?.[0]
        ? {
            startupName: conversion.startups[0].companyName || "Unknown Company",
            sector: conversion.startups[0].industry || undefined,
            stage: conversion.startups[0].fundingStage || undefined,
          }
        : null;
      if (draft) {
        await onAutoLogDecision({
          draft,
          conversion,
          sourceType: "upload",
          fileName: file.name || null,
          file,
        });
        toast({ title: "Decision logged", description: "Auto-created from extraction." });
      }
    } catch (error) {
      toast({
        title: "Conversion failed",
        description: error instanceof Error ? error.message : "File conversion failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, onAutoLogDecision]);

  const handleExtract = useCallback(async () => {
    if (!documentText.trim()) {
      toast({ title: "No content", description: "Please paste or upload document text", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setResult(null);

    try {
      let input = documentText;
      if (input.length > MAX_PASTE_CHARS) {
        input = input.slice(0, MAX_PASTE_CHARS);
        toast({
          title: "Content trimmed",
          description: "Pasted text was too long; we trimmed it to fit the converter limit.",
        });
      }

      const conversion = await convertWithAI(input);
      setResult(conversion);
      toast({
        title: "Extraction complete",
        description: `Detected ${conversion.detectedType || "data"}`,
      });

      const draft = conversion.startups?.[0]
        ? {
            startupName: conversion.startups[0].companyName || "Unknown Company",
            sector: conversion.startups[0].industry || undefined,
            stage: conversion.startups[0].fundingStage || undefined,
          }
        : null;
      if (conversion.errors?.length && !draft) {
        toast({
          title: "Extraction warning",
          description: conversion.errors[0],
          variant: "destructive",
        });
      }

      if (draft) {
        await onAutoLogDecision({
          draft,
          conversion,
          sourceType: "paste",
          fileName: null,
          file: null,
        });
        toast({ title: "Decision logged", description: "Auto-created from extraction." });
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
  }, [documentText, toast, onAutoLogDecision]);

  const downloadJSON = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversion-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const primaryStartup = result?.startups?.[0];
  const quickLogEnabled = !!primaryStartup;

  const handleQuickLog = () => {
    if (!primaryStartup) return;
    onDecisionDraft({
      startupName: primaryStartup.companyName || "Unknown Company",
      sector: primaryStartup.industry || undefined,
      stage: primaryStartup.fundingStage || undefined,
    });
    onOpenDecisionLog();
  };

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
              <Label>Upload File</Label>
              <Input
                type="file"
                accept=".txt,.md,.pdf,.docx,.xlsx,.xls,.csv,.json"
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
                  Extract & Detect
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
            <Card className="border-green-500/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Conversion Result
                  </span>
                  {result && (
                    <Button size="sm" variant="outline" onClick={downloadJSON}>
                      <Download className="h-4 w-4 mr-1" />
                      JSON
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>Detected: {result.detectedType || "unknown"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {primaryStartup ? (
                    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg">{primaryStartup.companyName}</h3>
                        {primaryStartup.fundingStage && <Badge variant="outline">{primaryStartup.fundingStage}</Badge>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {primaryStartup.industry && <Badge>{primaryStartup.industry}</Badge>}
                        {primaryStartup.geoMarkets?.length > 0 && (
                          <Badge variant="secondary">{primaryStartup.geoMarkets.join(", ")}</Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No startup detected yet. Upload a pitch deck or paste content.
                    </div>
                  )}

                  {(result.errors?.length || result.warnings?.length) && (
                    <div className="border rounded-md p-3 text-xs space-y-2">
                      {result.errors?.length ? (
                        <div>
                          <div className="font-semibold text-destructive">Errors</div>
                          <ul className="list-disc list-inside text-destructive">
                            {result.errors.slice(0, 3).map((err) => (
                              <li key={err}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {result.warnings?.length ? (
                        <div>
                          <div className="font-semibold">Warnings</div>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {result.warnings.slice(0, 3).map((warn) => (
                              <li key={warn}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {quickLogEnabled && (
                    <Button onClick={handleQuickLog} className="w-full" variant="outline">
                      <ClipboardList className="h-4 w-4 mr-2" />
                      Open in Decision Log
                    </Button>
                  )}

                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View full JSON
                    </summary>
                    <pre className="mt-2 p-3 bg-muted rounded-lg overflow-auto max-h-[300px] text-xs">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
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

function DecisionLoggerTab({
  decisions,
  setDecisions,
  activeEventId,
  actorDefault,
  draftDecision,
  onDraftConsumed,
  documents,
  onOpenDocument,
}: {
  decisions: Decision[];
  setDecisions: React.Dispatch<React.SetStateAction<Decision[]>>;
  activeEventId: string | null;
  actorDefault: string;
  draftDecision: { startupName: string; sector?: string; stage?: string } | null;
  onDraftConsumed: () => void;
  documents: Array<{ id: string; title: string | null; storage_path: string | null }>;
  onOpenDocument: (documentId: string) => void;
}) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [actor, setActor] = useState(actorDefault);
  const [actionType, setActionType] = useState<Decision["actionType"]>("meeting");
  const [startupName, setStartupName] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [geo, setGeo] = useState("");
  const [confidence, setConfidence] = useState([70]);
  const [notes, setNotes] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("all");

  const filteredDecisions = useMemo(() => {
    if (selectedDocumentId === "all") return decisions;
    return decisions.filter((d) => d.documentId === selectedDocumentId);
  }, [decisions, selectedDocumentId]);

  const stats = useMemo(() => calculateDecisionStats(filteredDecisions), [filteredDecisions]);

  useEffect(() => {
    if (actorDefault && !actor) {
      setActor(actorDefault);
    }
  }, [actorDefault, actor]);

  useEffect(() => {
    if (!draftDecision) return;
    setStartupName(draftDecision.startupName);
    setSector(draftDecision.sector || "");
    setStage(draftDecision.stage || "");
    setShowForm(true);
    onDraftConsumed();
  }, [draftDecision, onDraftConsumed]);

  const handleSaveDecision = useCallback(async () => {
    if (!activeEventId) {
      toast({ title: "No active event", description: "Please refresh and try again.", variant: "destructive" });
      return;
    }
    if (!actor.trim() || !startupName.trim()) {
      toast({ title: "Missing fields", description: "Actor and Startup name are required", variant: "destructive" });
      return;
    }
    const { data, error } = await insertDecision(activeEventId, {
      actor_id: null,
      actor_name: actor.trim(),
      action_type: actionType,
      startup_name: startupName.trim(),
      context: {
        sector: sector.trim() || undefined,
        stage: stage.trim() || undefined,
        geo: geo.trim() || undefined,
      },
      confidence_score: confidence[0],
      outcome: "pending",
      notes: notes.trim() || null,
    });

    if (error || !data) {
      toast({ title: "Save failed", description: "Supabase rejected the decision.", variant: "destructive" });
      return;
    }

    setDecisions(prev => [mapDecisionRow(data), ...prev]);
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
  }, [activeEventId, actor, actionType, startupName, sector, stage, geo, confidence, notes, toast, setDecisions]);

  const handleDeleteDecision = useCallback(async (id: string) => {
    const { error } = await deleteDecision(id);
    if (error) {
      toast({ title: "Delete failed", description: "Supabase rejected the delete.", variant: "destructive" });
      return;
    }
    setDecisions(prev => prev.filter(d => d.id !== id));
    toast({ title: "Deleted", description: "Decision removed" });
  }, [toast, setDecisions]);

  const handleUpdateOutcome = useCallback(async (id: string, outcome: Decision["outcome"]) => {
    const { error } = await updateDecision(id, { outcome });
    if (error) {
      toast({ title: "Update failed", description: "Supabase rejected the update.", variant: "destructive" });
      return;
    }
    setDecisions(prev =>
      prev.map(d => (d.id === id ? { ...d, outcome } : d))
    );
  }, [toast, setDecisions]);

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

  const documentOptions = [
    { id: "all", label: "All documents" },
    ...documents.map((doc) => ({ id: doc.id, label: doc.title || "Untitled document" })),
  ];

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
      <div className="flex gap-2 items-center">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Log New Decision"}
        </Button>
        {decisions.length > 0 && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        )}
        <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by document" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All documents</SelectItem>
            {documents.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.title || doc.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {filteredDecisions.length} decisions shown • Click outcome to update
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground">Filter by document</Label>
            <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {documentOptions.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredDecisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No decisions logged yet</p>
              <p className="text-sm">Start logging decisions to build your pattern database</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-auto">
              {filteredDecisions.slice().reverse().map((d) => {
                const doc = documents.find((doc) => doc.id === d.documentId);
                return (
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
                      {doc && (
                        <p className="text-xs text-muted-foreground">
                          Source: {doc.title || "Document"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{d.confidenceScore}%</span>
                    {doc?.storage_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenDocument(doc.id)}
                      >
                        View source
                      </Button>
                    )}
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
              )})}
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
// SOURCES TAB
// ============================================================================

function SourcesTab({
  sources,
  onCreateSource,
  onDeleteSource,
  getGoogleAccessToken,
  onAutoLogDecision,
  activeEventId,
  ensureActiveEventId,
}: {
  sources: SourceRecord[];
  onCreateSource: (
    payload: {
      title: string | null;
      source_type: SourceRecord["source_type"];
      external_url: string | null;
      tags: string[] | null;
      status: SourceRecord["status"];
    },
    eventIdOverride?: string | null
  ) => Promise<void>;
  onDeleteSource: (sourceId: string) => Promise<void>;
  getGoogleAccessToken: () => Promise<string | null>;
  onAutoLogDecision: (input: {
    draft: { startupName: string; sector?: string; stage?: string };
    conversion: AIConversionResponse;
    sourceType: "upload" | "paste" | "api";
    fileName: string | null;
    file: File | null;
    rawContent?: string | null;
    eventIdOverride?: string | null;
  }) => Promise<void>;
  activeEventId: string | null;
  ensureActiveEventId: () => Promise<string | null>;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<SourceRecord["source_type"]>("syndicate");
  const [externalUrl, setExternalUrl] = useState("");
  const [tags, setTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [clickUpListId, setClickUpListId] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [isImportingClickUp, setIsImportingClickUp] = useState(false);
  const [isImportingDrive, setIsImportingDrive] = useState(false);
  const [autoExtract, setAutoExtract] = useState(true);
  const MAX_IMPORT_CHARS = 24000;
  const canImport = Boolean(activeEventId);

  const handleAdd = useCallback(async () => {
    if (!title.trim() && !externalUrl.trim()) {
      toast({
        title: "Missing details",
        description: "Add a title or a URL to create a source.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      await onCreateSource({
        title: title.trim() || null,
        source_type: sourceType,
        external_url: externalUrl.trim() || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status: "active",
      });
      setTitle("");
      setExternalUrl("");
      setTags("");
    } catch (error) {
      toast({
        title: "Create failed",
        description: error instanceof Error ? error.message : "Could not create source.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [externalUrl, onCreateSource, sourceType, tags, title, toast]);

  const handleImportClickUp = useCallback(async () => {
    const eventId = activeEventId || (await ensureActiveEventId());
    if (!eventId) {
      toast({
        title: "No active event",
        description: "Create or activate an event before importing.",
        variant: "destructive",
      });
      return;
    }
    if (!clickUpListId.trim()) {
      toast({
        title: "Missing list ID",
        description: "Enter a ClickUp list ID to import tasks.",
        variant: "destructive",
      });
      return;
    }
    setIsImportingClickUp(true);
    try {
      const response = await ingestClickUpList(clickUpListId.trim(), true);
      let created = 0;
      for (const task of response.tasks || []) {
        const tagList = ["clickup", task.status || ""]
          .concat(task.assignees || [])
          .map((t) => t.trim())
          .filter(Boolean);
        await onCreateSource({
          title: task.name || "ClickUp task",
          source_type: "syndicate",
          external_url: task.url || null,
          tags: tagList.length ? tagList : null,
          status: "active",
        }, eventId);
        created += 1;
      }
      toast({ title: "Import complete", description: `Imported ${created} ClickUp tasks.` });
      setClickUpListId("");
    } catch (error) {
      toast({
        title: "ClickUp import failed",
        description: error instanceof Error ? error.message : "Could not import ClickUp tasks.",
        variant: "destructive",
      });
    } finally {
      setIsImportingClickUp(false);
    }
  }, [activeEventId, clickUpListId, ensureActiveEventId, onCreateSource, toast]);

  const handleImportDrive = useCallback(async () => {
    const eventId = activeEventId || (await ensureActiveEventId());
    if (!eventId) {
      toast({
        title: "No active event",
        description: "Create or activate an event before importing.",
        variant: "destructive",
      });
      return;
    }
    if (!driveUrl.trim()) {
      toast({
        title: "Missing Drive link",
        description: "Paste a Google Drive link to import.",
        variant: "destructive",
      });
      return;
    }
    setIsImportingDrive(true);
    try {
      const accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        toast({
          title: "Google Drive access needed",
          description: "Please sign in again with Google Drive access enabled.",
          variant: "destructive",
        });
        return;
      }
      const result = await ingestGoogleDrive(driveUrl.trim(), accessToken);
      await onCreateSource({
        title: result.title || "Google Drive source",
        source_type: "notes",
        external_url: driveUrl.trim(),
        tags: ["google-drive"],
        status: "active",
      }, eventId);
      toast({ title: "Drive import complete", description: "Source saved to your library." });

      const rawContent = result.raw_content || result.content;
      let autoLogged = false;
      let conversionResult: AIConversionResponse | null = null;
      if (autoExtract && rawContent) {
        const content = rawContent.length > MAX_IMPORT_CHARS ? rawContent.slice(0, MAX_IMPORT_CHARS) : rawContent;
        conversionResult = await convertWithAI(content);
        const primary = conversionResult.startups?.[0];
        if (primary?.companyName) {
          await onAutoLogDecision({
            draft: {
              startupName: primary.companyName || "Unknown Company",
              sector: primary.industry || undefined,
              stage: primary.fundingStage || undefined,
            },
            conversion: conversionResult,
            sourceType: "api",
            fileName: result.title || null,
            file: null,
            rawContent, // Store the raw content from Google Drive
            eventIdOverride: eventId,
          });
          autoLogged = true;
          toast({ title: "Decision logged", description: "Auto-created from Drive extraction." });
        } else if (conversionResult.errors?.length) {
          toast({ title: "Extraction warning", description: conversionResult.errors[0], variant: "destructive" });
        } else {
          toast({ title: "No startup detected", description: "Extraction completed, but no company was found." });
        }
      }

      if (rawContent && !autoLogged) {
        const { data: doc, error: docError } = await insertDocument(eventId, {
          title: result.title || "Google Drive import",
          source_type: "api",
          file_name: result.title || null,
          storage_path: null,
          detected_type: conversionResult?.detectedType || null,
          extracted_json: (conversionResult || {}) as Record<string, any>,
          raw_content: rawContent,
          created_by: profile?.id || null,
        });
        if (docError || !doc?.id) {
          toast({
            title: "Document save failed",
            description: docError?.message || "Could not save the Drive content to documents.",
            variant: "destructive",
          });
        } else {
          setDocuments((prev) => [
            { id: doc.id, title: doc.title || null, storage_path: doc.storage_path || null },
            ...prev,
          ]);
          toast({ title: "Document saved", description: "Raw content stored in Documents." });
        }
      }

      setDriveUrl("");
    } catch (error) {
      toast({
        title: "Drive import failed",
        description: error instanceof Error ? error.message : "Could not import Google Drive file.",
        variant: "destructive",
      });
    } finally {
      setIsImportingDrive(false);
    }
  }, [activeEventId, autoExtract, driveUrl, ensureActiveEventId, getGoogleAccessToken, onAutoLogDecision, onCreateSource, profile?.id, toast]);

  return (
    <div className="space-y-6">
      {!canImport && (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Loading your active event... Imports will be available in a moment.
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>ClickUp Import</CardTitle>
          <CardDescription>Pull syndicate tasks directly from a ClickUp list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>ClickUp List ID</Label>
              <Input
                value={clickUpListId}
                onChange={(e) => setClickUpListId(e.target.value)}
                placeholder="e.g., 90120481234"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleImportClickUp} disabled={isImportingClickUp} className="w-full">
                {isImportingClickUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Import ClickUp
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Uses server-side token. Ask admin to set CLICKUP_API_TOKEN in the converter service.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Google Drive Import</CardTitle>
          <CardDescription>Paste a Google Docs/Slides/Sheets link to register it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Drive URL</Label>
              <Input
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/..."
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleImportDrive} disabled={isImportingDrive} className="w-full">
                {isImportingDrive ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Import Drive
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={autoExtract} onCheckedChange={(val) => setAutoExtract(val === true)} />
            Auto-extract and log decision after import
          </label>
          <p className="text-xs text-muted-foreground">
            Uses your Google Drive OAuth token. If access fails, sign out and sign in again.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source Library</CardTitle>
          <CardDescription>Track syndicates, company decks, and notes in one place.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Syndicate: Astor Ventures"
              />
            </div>
            <div>
              <Label>Source Type</Label>
              <Select value={sourceType} onValueChange={(value) => setSourceType(value as SourceRecord["source_type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="syndicate">Syndicate</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="deck">Deck</SelectItem>
                  <SelectItem value="notes">Notes</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>External URL (optional)</Label>
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
              />
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="SEA, fintech, seed"
              />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Add Source
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracked Sources</CardTitle>
          <CardDescription>{sources.length} items</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sources.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sources yet. Add your first syndicate or company source.</div>
          ) : (
            sources.map((source) => (
              <div key={source.id} className="flex items-center justify-between gap-3 border rounded-md p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{source.source_type}</Badge>
                    {source.status !== "active" && <Badge variant="secondary">{source.status}</Badge>}
                  </div>
                  <div className="font-medium">{source.title || "Untitled source"}</div>
                  {source.external_url && (
                    <div className="text-xs text-muted-foreground truncate max-w-[420px]">{source.external_url}</div>
                  )}
                  {source.tags && source.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {source.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {source.external_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={source.external_url} target="_blank" rel="noreferrer">
                        <Link2 className="h-4 w-4 mr-1" />
                        Open
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => onDeleteSource(source.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DECISION ENGINE DASHBOARD TAB
// ============================================================================

function DecisionEngineDashboardTab({ decisions }: { decisions: Decision[] }) {
  const stats = useMemo(() => calculateDecisionStats(decisions), [decisions]);
  const uniqueActors = new Set(decisions.map((d) => d.actor).filter(Boolean)).size;
  const positiveOutcomes = stats.byOutcome.positive || 0;
  const hasEnoughData = decisions.length >= 20;

  const patternCards = [
    {
      title: "Intro Timing Effects",
      insight: hasEnoughData ? "Derived from decision history (rolling 90d)." : "Not enough data to compute yet.",
      tag: "Timing",
      signal: hasEnoughData ? "Live" : "Needs data",
    },
    {
      title: "Partner Attention Drift",
      insight: hasEnoughData ? "Comparing partner time vs. winning sectors." : "Not enough data to compute yet.",
      tag: "Behavior",
      signal: hasEnoughData ? "Live" : "Needs data",
    },
    {
      title: "Peer Signal Reversal",
      insight: hasEnoughData ? "Tracking pass → invest reversals." : "Not enough data to compute yet.",
      tag: "Network",
      signal: hasEnoughData ? "Live" : "Needs data",
    },
    {
      title: "Warm Intro Lift",
      insight: hasEnoughData ? "Warm vs. cold intro follow‑up rate." : "Not enough data to compute yet.",
      tag: "Signal",
      signal: hasEnoughData ? "Live" : "Needs data",
    },
  ];

  const graphNodes = ["Founder", "Startup", "Investor", "Partner", "Intro", "Meeting", "Outcome"];
  const graphEdges = ["Introduced", "Met", "Followed up", "Passed", "Invested"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDecisions}</p>
                <p className="text-xs text-muted-foreground">Decisions Logged</p>
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
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueActors}</p>
                <p className="text-xs text-muted-foreground">Active Partners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{positiveOutcomes}</p>
                <p className="text-xs text-muted-foreground">Positive Outcomes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Undiscovered Pattern Dashboard</CardTitle>
          <CardDescription>
            Real edge comes from longitudinal decision data, not complex models.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {patternCards.map((card) => (
            <div key={card.title} className="border rounded-lg p-3 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{card.title}</div>
                <Badge variant="outline">{card.tag}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">{card.insight}</div>
              <div className="text-xs text-muted-foreground">{card.signal}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Decision Graph (Phase 1)</CardTitle>
          <CardDescription>Cheap, structured foundation. No ML required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">Nodes</div>
            <div className="flex flex-wrap gap-2">
              {graphNodes.map((node) => (
                <Badge key={node} variant="secondary">
                  {node}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Edges</div>
            <div className="flex flex-wrap gap-2">
              {graphEdges.map((edge) => (
                <Badge key={edge} variant="outline">
                  {edge}
                </Badge>
              ))}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Store every action as an edge. The graph itself becomes the intelligence layer.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phase 1: Decision Graph</CardTitle>
            <CardDescription>Postgres tables + constraints</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>Data: intros, meetings, outcomes</div>
            <div>Output: cross‑fund pattern visibility</div>
            <Badge variant="secondary">Cost: near zero</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phase 2: Scored Decisions</CardTitle>
            <CardDescription>Statistics, not ML</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>Data: actor, context, confidence</div>
            <div>Output: win‑rate by partner/sector</div>
            <Badge variant="secondary">Cost: low</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phase 3: Lightweight Learning</CardTitle>
            <CardDescription>After 1k+ decisions</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>Models: logistic/Bayesian/bandits</div>
            <div>Output: ranked decisions + alerts</div>
            <Badge variant="secondary">Cost: &lt;$5k/mo</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Best Build Path (SaaS)</CardTitle>
          <CardDescription>Operating system for VC networks, not “chat over files”.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Start with structured decision capture + strict schemas.
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Add privacy boundaries by organization and event.
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Use Claude only for extraction and summarization, not decisions.
          </div>
          <Separator />
          <div className="text-xs">
            Goal: trust, constraints, and repeatable decisions before advanced ML.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MAIN CIS COMPONENT
// ============================================================================

export default function CIS() {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const [scopes, setScopes] = useState<ScopeItem[]>(initialScopes);
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [activeThread, setActiveThread] = useState<string>(initialThreads[0]?.id ?? "");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; title: string | null; storage_path: string | null }>>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [draftDecision, setDraftDecision] = useState<{
    startupName: string;
    sector?: string;
    stage?: string;
  } | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{
    id: string;
    title: string | null;
    raw_content: string | null;
    extracted_json: Record<string, any> | null;
    file_name: string | null;
    storage_path: string | null;
  } | null>(null);

  const handleOpenDocument = useCallback(
    async (documentId: string) => {
      const { data: doc, error } = await getDocumentById(documentId);
      if (error || !doc) {
        toast({
          title: "Document not found",
          description: "Could not load document details.",
          variant: "destructive",
        });
        return;
      }
      const docData = doc as any;
      setViewingDocument({
        id: docData.id,
        title: docData.title,
        raw_content: docData.raw_content || null,
        extracted_json: docData.extracted_json || null,
        file_name: docData.file_name || null,
        storage_path: docData.storage_path || null,
      });
    },
    [toast]
  );

  const handleCreateSource = useCallback(
    async (
      payload: {
        title: string | null;
        source_type: SourceRecord["source_type"];
        external_url: string | null;
        tags: string[] | null;
        status: SourceRecord["status"];
      },
      eventIdOverride?: string | null
    ) => {
      const eventId = eventIdOverride ?? activeEventId;
      if (!eventId) {
        throw new Error("No active event available.");
      }
      const { data, error } = await insertSource(eventId, {
        ...payload,
        storage_path: null,
        created_by: profile?.id || null,
      });
      if (error || !data) {
        throw new Error("Supabase rejected the source.");
      }
      setSources((prev) => [data as SourceRecord, ...prev]);
    },
    [activeEventId, profile]
  );

  const ensureActiveEventId = useCallback(async () => {
    if (!profile) return null;
    const { data: orgData, error: orgError } = await ensureOrganizationForUser(profile);
    if (orgError || !orgData?.organization) {
      toast({
        title: "Organization missing",
        description: "We could not load your organization.",
        variant: "destructive",
      });
      return null;
    }
    const { data: event, error: eventError } = await ensureActiveEventForOrg(orgData.organization.id);
    if (eventError || !event) {
      toast({
        title: "No active event",
        description: "Create or activate an event first.",
        variant: "destructive",
      });
      return null;
    }
    setActiveEventId(event.id);
    return event.id;
  }, [profile, toast]);

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    const { error } = await deleteSource(sourceId);
    if (error) {
      return;
    }
    setSources((prev) => prev.filter((source) => source.id !== sourceId));
  }, []);

  const getGoogleAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.provider_token || null;
  }, []);

  const handleAutoLogDecision = useCallback(
    async (input: {
      draft: { startupName: string; sector?: string; stage?: string };
      conversion: AIConversionResponse;
      sourceType: "upload" | "paste" | "api";
      fileName: string | null;
      file: File | null;
      rawContent?: string | null;
      eventIdOverride?: string | null;
    }) => {
      const eventId = input.eventIdOverride ?? activeEventId;
      if (!eventId) {
        return;
      }
      let storagePath: string | null = null;
      if (input.file) {
        const safeName = input.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_") || "document";
        const path = `${eventId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("cis-documents")
          .upload(path, input.file, { upsert: true });
        if (!uploadError) {
          storagePath = path;
        }
      }

      const { data: doc, error: docError } = await insertDocument(eventId, {
        title: input.draft.startupName,
        source_type: input.sourceType,
        file_name: input.fileName,
        storage_path: storagePath,
        detected_type: input.conversion.detectedType || "unknown",
        extracted_json: input.conversion as unknown as Record<string, any>,
        raw_content: input.rawContent || null,
        created_by: profile?.id || null,
      });

      const docRecord = doc as { id?: string; title?: string | null; storage_path?: string | null } | null;
      const docId = docRecord?.id;
      if (docError || !docId) {
        return;
      }
      setDocuments((prev) => [
        { id: docId, title: docRecord?.title || null, storage_path: docRecord?.storage_path || null },
        ...prev,
      ]);

      const { data: decision, error } = await insertDecision(eventId, {
        actor_id: profile?.id || null,
        actor_name: profile?.full_name || profile?.email || "Unknown",
        action_type: "meeting",
        startup_name: input.draft.startupName,
        context: {
          sector: input.draft.sector || undefined,
          stage: input.draft.stage || undefined,
        },
        confidence_score: 70,
        outcome: "pending",
        notes: null,
        document_id: docId,
      });

      if (error || !decision) {
        return;
      }
      setDecisions((prev) => [mapDecisionRow(decision), ...prev]);
      if (storagePath) {
        setDocuments((prev) => [{ id: docId, title: input.draft.startupName, storage_path: storagePath }, ...prev]);
      }
    },
    [activeEventId, profile]
  );

  const scopedMessages = useMemo(() => messages.filter((m) => m.threadId === activeThread), [messages, activeThread]);

  useEffect(() => {
    let cancelled = false;
    const loadDecisions = async () => {
      if (!profile) return;
      // Sync decisions from Supabase

      const { data: orgData, error: orgError } = await ensureOrganizationForUser(profile);
      if (orgError || !orgData?.organization) {
        return;
      }

      const { data: event, error: eventError } = await ensureActiveEventForOrg(orgData.organization.id);
      if (eventError || !event) {
        return;
      }

      if (cancelled) return;
      setActiveEventId(event.id);

      const [decisionsRes, documentsRes, sourcesRes] = await Promise.all([
        getDecisionsByEvent(event.id),
        getDocumentsByEvent(event.id),
        getSourcesByEvent(event.id),
      ]);
      if (cancelled) return;
      const mapped = (decisionsRes.data || []).map(mapDecisionRow);
      setDecisions(mapped);
      setDocuments(
        (documentsRes.data || []).map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          storage_path: doc.storage_path || null,
        }))
      );
      setSources((sourcesRes.data || []) as SourceRecord[]);
    };

    loadDecisions();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const addMessage = () => {
    if (!input.trim()) return;
    let threadId = activeThread;
    if (!threadId) {
      const newThreadId = `t-${Date.now()}`;
      setThreads((prev) => [...prev, { id: newThreadId, title: "Main thread" }]);
      setActiveThread(newThreadId);
      threadId = newThreadId;
    }
    const id = `m-${Date.now()}`;
    setMessages((prev) => [...prev, { id, author: "user", text: input.trim(), threadId }]);
    setInput("");
  };

  const createBranch = (title: string) => {
    const id = `t-${Date.now()}`;
    const parentId = activeThread || undefined;
    setThreads((prev) => [...prev, { id, title, parentId }]);
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              Company Intelligence System
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-powered document extraction, decision tracking, and knowledge management
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="border rounded-md px-3 py-2 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">
                {profile?.full_name || profile?.email || "Signed-in user"}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{profile?.role || "member"}</Badge>
                {profile?.organization_id ? (
                  <span className="truncate">Org: {profile.organization_id}</span>
                ) : (
                  <span>Org: pending</span>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={signOut}>
              Log out
            </Button>
            <Button variant="outline" asChild>
              <a href="/">← Back to Matchmaking</a>
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Intelligence Chat
            </TabsTrigger>
            <TabsTrigger value="converter" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document Converter
            </TabsTrigger>
            <TabsTrigger value="sources" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Sources
            </TabsTrigger>
            <TabsTrigger value="decisions" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Decision Logger
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Decision Engine
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
                    {threads.length > 0 ? (
                      <ThreadTree threads={threads} active={activeThread} onSelect={setActiveThread} />
                    ) : (
                      <div className="text-xs text-muted-foreground">No threads yet.</div>
                    )}
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
                      {scopedMessages.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-10">
                          No messages yet. Start the first question to build the memory trail.
                        </div>
                      ) : (
                        scopedMessages.map((m) => (
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
                        ))
                      )}
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
                    {evidence.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No knowledge objects yet.</div>
                    ) : (
                      evidence.map((ko) => (
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
                      ))
                    )}
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

          {/* Sources Tab */}
          <TabsContent value="sources">
            <SourcesTab
              sources={sources}
              onCreateSource={handleCreateSource}
              onDeleteSource={handleDeleteSource}
              getGoogleAccessToken={getGoogleAccessToken}
              onAutoLogDecision={handleAutoLogDecision}
              activeEventId={activeEventId}
              ensureActiveEventId={ensureActiveEventId}
            />
          </TabsContent>

          {/* Converter Tab */}
          <TabsContent value="converter">
            <DocumentConverterTab
              onDecisionDraft={(draft) => setDraftDecision(draft)}
              onOpenDecisionLog={() => setActiveTab("decisions")}
              onAutoLogDecision={handleAutoLogDecision}
            />
          </TabsContent>

          {/* Decisions Tab */}
          <TabsContent value="decisions">
            <DecisionLoggerTab
              decisions={decisions}
              setDecisions={setDecisions}
              activeEventId={activeEventId}
              actorDefault={profile?.full_name || profile?.email || ""}
              draftDecision={draftDecision}
              onDraftConsumed={() => setDraftDecision(null)}
              documents={documents}
              onOpenDocument={handleOpenDocument}
            />
          </TabsContent>

          {/* Decision Engine Dashboard Tab */}
          <TabsContent value="dashboard">
            <DecisionEngineDashboardTab decisions={decisions} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Document Viewer Modal */}
      <Dialog open={!!viewingDocument} onOpenChange={(open) => !open && setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewingDocument?.title || "Document Viewer"}</DialogTitle>
            <DialogDescription>
              {viewingDocument?.file_name && `File: ${viewingDocument.file_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4">
            <Tabs defaultValue="extracted" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="extracted">Extracted JSON</TabsTrigger>
                <TabsTrigger value="raw">Raw Content</TabsTrigger>
              </TabsList>
              <TabsContent value="extracted" className="mt-4">
                {viewingDocument?.extracted_json ? (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground mb-2">
                      Structured data extracted by AI
                    </div>
                    <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-[500px] text-xs">
                      {JSON.stringify(viewingDocument.extracted_json, null, 2)}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(viewingDocument?.extracted_json, null, 2)], {
                          type: "application/json",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${viewingDocument?.title || "document"}-extracted.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download JSON
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No extracted JSON available</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="raw" className="mt-4">
                {viewingDocument?.raw_content ? (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground mb-2">
                      Original text content ({viewingDocument.raw_content.length} characters)
                    </div>
                    <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-[500px] text-xs whitespace-pre-wrap">
                      {viewingDocument.raw_content}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const blob = new Blob([viewingDocument?.raw_content || ""], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${viewingDocument?.title || "document"}-raw.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Raw Text
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No raw content stored</p>
                    {viewingDocument?.storage_path && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-4"
                        onClick={async () => {
                          if (!viewingDocument?.storage_path) return;
                          const { data, error } = await supabase.storage
                            .from("cis-documents")
                            .createSignedUrl(viewingDocument.storage_path, 60);
                          if (error || !data?.signedUrl) {
                            toast({
                              title: "File not found",
                              description: "Could not access stored file.",
                              variant: "destructive",
                            });
                            return;
                          }
                          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Open Stored File
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
