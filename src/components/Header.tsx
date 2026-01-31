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
  hasData
}: HeaderProps) {
  const { user, profile } = useAuth();
  const [scrollY, setScrollY] = useState(0);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      ref={headerRef}
      className="relative border-b-2 border-white bg-[#050505] text-white transition-all duration-300"
      style={{
        backdropFilter: scrollY > 50 ? "blur(10px)" : "none",
        backgroundColor: scrollY > 50 ? "rgba(5, 5, 5, 0.95)" : "#050505",
      }}
    >
      {/* Animated Grid Background */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`,
          backgroundImage: `
            linear-gradient(rgba(255, 237, 0, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 237, 0, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-black font-mono text-white tracking-tight">
              VENTUREOS
            </h1>
            <nav className="hidden md:flex space-x-6">
              <span className="text-sm font-medium text-white/70 uppercase tracking-wider">
                Venture Capital Platform
              </span>
            </nav>
          </div>

          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onImportData}
              className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] transition-all font-bold"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            
            <Button 
              size="sm" 
              onClick={onGenerateMatches}
              disabled={isRematching || !hasData}
              className="bg-[#FFED00] text-black hover:bg-[#FFED00]/80 font-bold border-2 border-[#FFED00] transition-all hover:shadow-[0_0_20px_rgba(255,237,0,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className={`h-4 w-4 mr-2 ${isRematching ? 'animate-spin' : ''}`} />
              {isRematching ? 'Generating...' : 'Generate Matches'}
            </Button>
            
            <Button 
              variant="outline"
              size="sm" 
              onClick={onExport}
              disabled={!hasData}
              className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            {user ? (
              <Link to="/profile">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-[#FFED00] font-bold">
                  <User className="h-4 w-4 mr-2" />
                  {profile?.full_name || user.email?.split('@')[0] || 'Profile'}
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button variant="outline" size="sm" className="border-2 border-white bg-transparent text-white hover:bg-white/10 hover:border-[#FFED00] hover:text-[#FFED00] font-bold">
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
