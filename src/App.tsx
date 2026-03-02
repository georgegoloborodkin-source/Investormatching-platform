import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import CIS from "./pages/CIS";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import AuthCallback from "./pages/AuthCallback";
import RoleSelection from "./pages/RoleSelection";
import InviteAcceptance from "./pages/InviteAcceptance";
import AdminPanel from "./pages/AdminPanel";
import OrbitStatsDemo from "./pages/OrbitStatsDemo";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Root redirect: preserve ?google_drive=connected so CIS can open folder picker after OAuth. Handle error too. */
function RootRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const driveParam = params.get("google_drive");
  if (driveParam === "connected") {
    return <Navigate to="/cis?google_drive=connected" replace />;
  }
  if (driveParam === "error") {
    const reason = params.get("reason") || "unknown";
    return <Navigate to={`/cis?google_drive=error&reason=${reason}`} replace />;
  }
  return <Navigate to="/orbit-stats" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="app-shell cis-grid-bg cis-mesh-bg">
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/orbit-stats" element={<OrbitStatsDemo />} />
            <Route
              path="/cis"
              element={
                <ProtectedRoute requireAuth>
                  <CIS />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute requireAuth>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/role-selection"
              element={
                <ProtectedRoute requireAuth>
                  <RoleSelection />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invite/:token"
              element={
                <ProtectedRoute requireAuth>
                  <InviteAcceptance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAuth>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            <Route path="/matchmaking" element={<Navigate to="/cis" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
