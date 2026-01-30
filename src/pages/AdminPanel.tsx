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
      console.error("Error loading fund codes:", err);
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
      console.error("Error creating fund code:", err);
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
      <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You must be an admin to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage fund codes for Managing Partners
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Create Fund Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Fund Code
            </CardTitle>
            <CardDescription>
              Generate a fund code for a Managing Partner to use
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Fund Name *</Label>
              <Input
                placeholder="e.g., Orbit Ventures"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label>Fund Type</Label>
              <Select value={fundType} onValueChange={setFundType} disabled={isCreating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vc">Venture Capital</SelectItem>
                  <SelectItem value="angel">Angel Fund</SelectItem>
                  <SelectItem value="syndicate">Syndicate</SelectItem>
                  <SelectItem value="family_office">Family Office</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Website (optional)</Label>
              <Input
                type="url"
                placeholder="https://yourfund.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={isCreating}
              />
            </div>

            <Button
              onClick={handleCreateFundCode}
              disabled={isCreating || !fundName.trim()}
              className="w-full"
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

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-2">
              <p className="font-medium">1. Create Fund Code</p>
              <p className="text-muted-foreground">
                Enter fund details and generate a unique code (e.g., ORBIT-1234)
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium">2. Share with MD</p>
              <p className="text-muted-foreground">
                Give the code to the Managing Partner. They'll enter it during signup.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium">3. MD Creates Fund</p>
              <p className="text-muted-foreground">
                First MD to use the code creates the fund. Subsequent MDs join the same fund.
              </p>
            </div>
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Each fund code can only be used once to create a fund, but multiple MDs can join using the same code.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Fund Codes List */}
      <Card>
        <CardHeader>
          <CardTitle>Fund Codes ({fundCodes.length})</CardTitle>
          <CardDescription>All fund codes you've created</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : fundCodes.length === 0 ? (
            <Alert>
              <AlertDescription>No fund codes created yet. Create your first one above.</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Fund Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fundCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{code.code}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyCode(code.code)}
                          >
                            {copiedCode === code.code ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{code.fund_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{code.fund_type || "N/A"}</Badge>
                      </TableCell>
                      <TableCell>
                        {code.used_at ? (
                          <Badge variant="default">Used</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(code.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {code.used_at ? new Date(code.used_at).toLocaleDateString() : "Not used"}
                      </TableCell>
                      <TableCell>
                        {!code.used_at && (
                          <Button
                            variant="ghost"
                            size="sm"
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
