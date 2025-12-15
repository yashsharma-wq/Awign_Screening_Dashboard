import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Target, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  FileSearch,
  FileText,
  Loader2,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import AwignLogo from "./AwignLogo";

const Layout = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const getInitials = (email?: string | null) => {
    if (!email) return "";
    const localPart = email.split("@")[0] || "";
    const parts = localPart.split(/[\W_]+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    }
    return localPart.slice(0, 2).toUpperCase();
  };

  useEffect(() => {
    // Check session - with persistSession: false, sessions won't persist across browser sessions
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Error getting session:", error);
        setLoading(false);
        navigate("/login");
        return;
      }
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session) {
        navigate("/login");
      }
    }).catch((error) => {
      console.error("Error in getSession:", error);
      setLoading(false);
      navigate("/login");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/login");
      }
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
    navigate("/login");
  };

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/uploader", icon: Upload, label: "Bulk Upload" },
    { to: "/jobs", icon: Briefcase, label: "Jobs" },
    { to: "/candidates", icon: Users, label: "Candidates" },
    { to: "/applications", icon: FileText, label: "Applications" },
    { to: "/resume-scoring", icon: FileSearch, label: "Resume Scoring" },
    { to: "/screening", icon: Target, label: "Screening" },
    { to: "/analytics", icon: BarChart3, label: "Analytics" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b-2 border-blue-700 bg-white sticky top-0 z-50 shadow-sm">
        <div className="w-full px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink">
              <AwignLogo />
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight whitespace-nowrap flex-shrink-0">
                AI Screening
              </h1>
              <nav
                className="hidden md:flex items-center gap-2 ml-4 sm:ml-8 flex-shrink overflow-x-auto pr-2"
                style={{ scrollbarWidth: "none" }}
              >
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="hidden md:block text-sm text-muted-foreground font-medium px-3 py-1.5 rounded-md bg-muted/50 cursor-default">
                    {getInitials(user?.email) || "?"}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{user?.email || "Unknown user"}</p>
                </TooltipContent>
              </Tooltip>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout} 
                className="hidden md:flex hover:bg-muted/80 rounded-lg"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden rounded-lg"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b-2 border-blue-700 bg-white">
          <nav className="w-full px-6 py-4 flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="justify-start text-muted-foreground hover:text-foreground hover:bg-muted/60 mt-2 rounded-lg"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="w-full px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
