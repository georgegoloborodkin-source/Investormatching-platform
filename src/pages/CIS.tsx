import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

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

function ThreadTree({ threads, active, onSelect }: { threads: Thread[]; active: string; onSelect: (id: string) => void }) {
  // simple flat render with indentation
  const renderThread = (t: Thread, level = 0) => {
    return (
      <div
        key={t.id}
        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted ${
          active === t.id ? "bg-muted" : ""
        }`}
        style={{ paddingLeft: `${level * 12}px` }}
        onClick={() => onSelect(t.id)}
      >
        <span className="text-xs text-muted-foreground">branch</span>
        <span className="font-medium">{t.title}</span>
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

export default function CIS() {
  const [scopes, setScopes] = useState<ScopeItem[]>(initialScopes);
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [activeThread, setActiveThread] = useState<string>("t1");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

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

  const evidence = initialKOs; // static for shell

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Company Intelligence System</h1>
            <p className="text-sm text-muted-foreground">
              Chat-first reasoning with scope control, branching threads, and evidence-backed answers.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            Scope applied:{" "}
            {scopes
              .filter((s) => s.checked)
              .map((s) => s.label)
              .join(", ") || "None"}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left: Scope */}
          <div className="col-span-12 lg:col-span-3 space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Scope</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {scopes.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm border px-2 py-1 rounded-md cursor-pointer">
                    <Checkbox checked={s.checked} onCheckedChange={(val) => toggleScope(s.id, val === true)} />
                    <span>{s.label}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {s.type}
                    </Badge>
                  </label>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Threads (Branching)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ThreadTree threads={threads} active={activeThread} onSelect={setActiveThread} />
                <Button size="sm" variant="outline" onClick={() => createBranch("New branch")}>
                  + New branch
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Center: Chat */}
          <div className="col-span-12 lg:col-span-6 space-y-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Branching Chat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-md p-3 h-[420px] overflow-auto space-y-3 bg-muted/30">
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
                        <div className="mt-2 flex gap-2">
                          <Button size="xs" variant="secondary" onClick={() => createBranch("Branch: follow-up")}>
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
                    className="min-h-[100px]"
                  />
                  <div className="flex items-center justify-between">
                    <Input placeholder="Add tags (company, deal, risk)" />
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
              <CardHeader>
                <CardTitle>Memory & Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidence.map((ko) => (
                  <div key={ko.id} className="border rounded-md p-3 space-y-1 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Badge>{ko.type}</Badge>
                      <div className="font-medium">{ko.title}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{ko.text}</div>
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
              <CardHeader>
                <CardTitle>Scope at a glance</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <div>Chat answers will respect the checked scope above.</div>
                <Separator />
                <div className="text-xs">
                  Tips:
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>Branch to explore alternatives without losing context.</li>
                    <li>Untick scope items to exclude sensitive or noisy sources.</li>
                    <li>Evidence shows extracted Knowledge Objects and sources.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


