import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Key, Plus, Copy, CheckCircle, Loader2, Trash2, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface FundCode {
  id: string;
  code: string;
  fund_name: string;
  fund_slug: string | null;
  fund_type: string | null;
  website: string | null;
  created_at: string;
  used_at: string | null;
  is_active: boolean;
  used_by: string | null;
}

export default function AdminPanel() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [fundCodes, setFundCodes] = useState<FundCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state
  const [fundName, setFundName] = useState("");
  const [fundType, setFundType] = useState<string>("vc");
  const [website, setWebsite] = useState("");

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      loadFundCodes();
    }
  }, [isAdmin]);

  const loadFundCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fund_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setFundCodes((data as FundCode[]) || []);
    } catch (err: any) {
      toast({
        title: "Failed to load fund codes",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFundCode = async () => {
    if (!fundName.trim()) {
      toast({
        title: "Fund name required",
        description: "Please enter a fund name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_fund_code", {
        fund_name: fundName.trim(),
        fund_slug: null,
        fund_type: fundType || null,
        website: website.trim() || null,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Fund code created!",
        description: `Code: ${data?.code}. Share this with the MD.`,
      });

      // Reset form
      setFundName("");
      setFundType("vc");
      setWebsite("");

      // Reload codes
      await loadFundCodes();
    } catch (err: any) {
      toast({
        title: "Failed to create fund code",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Copied!",
      description: "Fund code copied to clipboard.",
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 page-content">
        <Card className="w-full max-w-md border border-slate-700/60 bg-slate-900/50 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/60 bg-slate-800/30">
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-400" />
              Access Denied
            </CardTitle>
            <CardDescription className="text-slate-400">
              You must be an admin to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6 page-content">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-8 w-8 text-amber-400" />
            Admin Panel
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Create and manage fund codes for Managing Partners
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border border-slate-700/60 bg-slate-900/40 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/60 bg-slate-800/30">
            <CardTitle className="flex items-center gap-2 text-slate-900 font-semibold">
              <Plus className="h-5 w-5 text-amber-400" />
              Create Fund Code
            </CardTitle>
            <CardDescription className="text-slate-400">
              Generate a fund code for a Managing Partner to use
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label className="text-slate-300">Fund Name *</Label>
              <Input
                placeholder="e.g., My Organization"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                disabled={isCreating}
                className="bg-slate-800/50 border-slate-600 text-slate-900 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Fund Type</Label>
              <Select value={fundType} onValueChange={setFundType} disabled={isCreating}>
                <SelectTrigger className="bg-slate-800/50 border-slate-600 text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="vc" className="text-slate-900 focus:bg-slate-700">Venture Capital</SelectItem>
                  <SelectItem value="angel" className="text-slate-900 focus:bg-slate-700">Angel Fund</SelectItem>
                  <SelectItem value="syndicate" className="text-slate-900 focus:bg-slate-700">Syndicate</SelectItem>
                  <SelectItem value="family_office" className="text-slate-900 focus:bg-slate-700">Family Office</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Website (optional)</Label>
              <Input
                type="url"
                placeholder="https://yourfund.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={isCreating}
                className="bg-slate-800/50 border-slate-600 text-slate-900 placeholder:text-slate-500"
              />
            </div>

            <Button
              onClick={handleCreateFundCode}
              disabled={isCreating || !fundName.trim()}
              className="w-full rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold h-11"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Fund Code
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-slate-700/60 bg-slate-900/40 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/60 bg-slate-800/30">
            <CardTitle className="text-slate-900 font-semibold">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm pt-6">
            <div className="space-y-2">
              <p className="font-medium text-slate-900">1. Create Fund Code</p>
              <p className="text-slate-400">
                Enter fund details and generate a unique code (e.g., VOS-1234)
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-slate-900">2. Share with MD</p>
              <p className="text-slate-400">
                Give the code to the Managing Partner. They'll enter it during signup.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-slate-900">3. MD Creates Fund</p>
              <p className="text-slate-400">
                First MD to use the code creates the fund. Subsequent MDs join the same fund.
              </p>
            </div>
            <Alert className="border-amber-500/20 bg-amber-500/5 text-slate-300">
              <Key className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-xs">
                Each fund code can only be used once to create a fund, but multiple MDs can join using the same code.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-700/60 bg-slate-900/40 backdrop-blur-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-700/60 bg-slate-800/30">
          <CardTitle className="text-slate-900 font-semibold">Fund Codes ({fundCodes.length})</CardTitle>
          <CardDescription className="text-slate-400">All fund codes you've created</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            </div>
          ) : fundCodes.length === 0 ? (
            <Alert className="border-slate-600 bg-slate-800/30 text-slate-400">
              <AlertDescription>No fund codes created yet. Create your first one above.</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-700/60">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700/60 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-medium">Code</TableHead>
                    <TableHead className="text-slate-400 font-medium">Fund Name</TableHead>
                    <TableHead className="text-slate-400 font-medium">Type</TableHead>
                    <TableHead className="text-slate-400 font-medium">Status</TableHead>
                    <TableHead className="text-slate-400 font-medium">Created</TableHead>
                    <TableHead className="text-slate-400 font-medium">Used</TableHead>
                    <TableHead className="text-slate-400 font-medium">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fundCodes.map((code) => (
                    <TableRow key={code.id} className="border-slate-700/60 hover:bg-slate-800/40">
                      <TableCell className="text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400">{code.code}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-slate-900"
                            onClick={() => copyCode(code.code)}
                          >
                            {copiedCode === code.code ? (
                              <CheckCircle className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-200">{code.fund_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">{code.fund_type || "N/A"}</Badge>
                      </TableCell>
                      <TableCell>
                        {code.used_at ? (
                          <Badge className="bg-slate-600 text-slate-200">Used</Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-400/20">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {new Date(code.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {code.used_at ? new Date(code.used_at).toLocaleDateString() : "Not used"}
                      </TableCell>
                      <TableCell>
                        {!code.used_at && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-slate-900"
                            onClick={() => copyCode(code.code)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
