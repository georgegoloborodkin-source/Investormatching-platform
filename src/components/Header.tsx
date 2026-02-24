import { Button } from "@/components/ui/button";
import { Plus, Upload, RotateCcw, Download, User, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState } from "react";

interface HeaderProps {
  onImportData: () => void;
  onGenerateMatches: () => void;
  onRematch: () => void;
  onExport: () => void;
  isRematching?: boolean;
  hasData: boolean;
}

export function Header({
  onImportData,
  onGenerateMatches,
  onRematch,
  onExport,
  isRematching = false,
  hasData,
}: HeaderProps) {
  const { user, profile } = useAuth();
  const [scrollY, setScrollY] = useState(0);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrolled = scrollY > 40;
  const btnBase =
    "rounded-lg font-semibold transition-all duration-200 border";
  const btnPrimary =
    "bg-amber-500 text-slate-950 hover:bg-amber-400 border-amber-500/50 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.4)] hover:shadow-[0_4px_20px_-2px_rgba(245,158,11,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";
  const btnSecondary =
    "border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60 hover:border-slate-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "border-slate-700/60 bg-slate-950/90 backdrop-blur-xl shadow-lg shadow-black/10"
          : "border-slate-800/50 bg-transparent"
      }`}
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="text-xl font-bold text-white tracking-tight hover:text-amber-400 transition-colors duration-200"
            >
              Platform
            </Link>
            <span className="hidden md:inline text-sm text-slate-400 font-medium">
              Platform
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onImportData}
              className={`${btnBase} ${btnSecondary} h-9 px-4`}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>

            <Button
              size="sm"
              onClick={onGenerateMatches}
              disabled={isRematching || !hasData}
              className={`${btnBase} ${btnPrimary} h-9 px-4`}
            >
              <RotateCcw
                className={`h-4 w-4 mr-2 ${isRematching ? "animate-spin" : ""}`}
              />
              {isRematching ? "Generating…" : "Generate Matches"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={!hasData}
              className={`${btnBase} ${btnSecondary} h-9 px-4`}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            {user ? (
              <Link to="/profile">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-300 hover:text-white hover:bg-slate-800/80 h-9 px-4 rounded-lg font-medium transition-colors duration-200"
                >
                  <User className="h-4 w-4 mr-2" />
                  {profile?.full_name || user.email?.split("@")[0] || "Profile"}
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button
                  variant="outline"
                  size="sm"
                  className={`${btnBase} ${btnSecondary} h-9 px-4`}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
