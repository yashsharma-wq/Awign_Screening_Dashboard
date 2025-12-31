import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Users, Target, Award, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

const PMAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalApplications: 0,
    totalScreened: 0,
    averageScore: 0,
    pending: 0,
    completed: 0,
    noResponse: 0,
    rejected: 0,
    qualified: 0,
    passRate: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // 1. Total Applications: total rows in 'AEX_Candidate_Data'
      const { count: totalApplications, error: applicationsError } = await supabase
        .from("AEX_Candidate_Data")
        .select("*", { count: "exact", head: true });

      if (applicationsError) {
        console.error("Error fetching applications count:", applicationsError);
      }

      // 2. Total Screened: total rows in 'AEX_Screening_Batch_Queue'
      const { count: totalScreened, error: screenedError } = await supabase
        .from("AEX_Screening_Batch_Queue")
        .select("*", { count: "exact", head: true });

      if (screenedError) {
        console.error("Error fetching screened count:", screenedError);
      }

      // 3. Average Score: average of 'Final Score' in 'AEX_Screening_Tracker'
      let trackerData: any[] | null = null;
      
      let trackerResult = await supabase
        .from("AEX_Screening_Tracker")
        .select("*");
      
      if (trackerResult.error) {
        // Fallback to lowercase table name
        trackerResult = await supabase
          .from("screening_tracker")
          .select("*");
      }
      
      trackerData = trackerResult.data || null;

      if (trackerResult.error) {
        console.error("Error fetching tracker data:", trackerResult.error);
      }

      // Calculate average score from tracker data
      let averageScore = 0;
      if (trackerData && trackerData.length > 0) {
        const scores = trackerData
          .map((t: any) => {
            // Try both formats: with space and snake_case
            const score = t["Final Score"] ?? t.final_score;
            // Handle string numbers
            if (typeof score === "string") {
              const parsed = parseFloat(score);
              return isNaN(parsed) ? null : parsed;
            }
            return score;
          })
          .filter((score): score is number => score !== null && score !== undefined && typeof score === "number");
        
        averageScore = scores.length > 0 
          ? scores.reduce((a, b) => a + b, 0) / scores.length 
          : 0;
      }

      // 4. Pending: total rows in 'AEX_Candidate_Data' with JD_Mapping='NOT STARTED'
      const { count: pending, error: pendingError } = await supabase
        .from("AEX_Candidate_Data")
        .select("*", { count: "exact", head: true })
        .eq("JD_Mapping", "NOT STARTED");

      if (pendingError) {
        console.error("Error fetching pending count:", pendingError);
      }

      // 5. Completed: total rows in 'AEX_Screening_Batch_Queue' with Status='Completed'
      const { count: completed, error: completedError } = await supabase
        .from("AEX_Screening_Batch_Queue")
        .select("*", { count: "exact", head: true })
        .eq("Status", "Completed");
      
      if (completedError) {
        console.error("Error fetching completed count:", completedError);
      }

      // 6. No Response: total rows in 'AEX_Screening_Batch_Queue' with Status='Waiting'
      const { count: noResponse, error: noResponseError } = await supabase
        .from("AEX_Screening_Batch_Queue")
        .select("*", { count: "exact", head: true })
        .eq("Status", "Waiting");
      
      if (noResponseError) {
        console.error("Error fetching no response count:", noResponseError);
      }

      // 7. Rejected: total rows in 'AEX_Screening_Tracker' with Screening_Outcome='Not Suitable'
      let rejected = 0;
      
      // First try to calculate from fetched tracker data (most reliable)
      if (trackerData && trackerData.length > 0) {
        rejected = trackerData.filter((t: any) => {
          const outcome = t["Screening_Outcome"] ?? t["Screening Outcome"] ?? t.screening_outcome;
          return outcome && outcome.toString().trim() === "Not Suitable";
        }).length;
      } else {
        // Fallback: Try count queries with different column name formats
        let rejectedResult = await supabase
          .from("AEX_Screening_Tracker")
          .select("*", { count: "exact", head: true })
          .eq("Screening_Outcome", "Not Suitable");
        
        if (rejectedResult.error) {
          // Try with space in column name
          rejectedResult = await supabase
            .from("AEX_Screening_Tracker")
            .select("*", { count: "exact", head: true })
            .eq("Screening Outcome", "Not Suitable");
        }
        
        if (rejectedResult.error) {
          // Try snake_case column name
          rejectedResult = await supabase
            .from("AEX_Screening_Tracker")
            .select("*", { count: "exact", head: true })
            .eq("screening_outcome", "Not Suitable");
        }
        
        if (rejectedResult.error) {
          // Try lowercase table name
          rejectedResult = await supabase
            .from("screening_tracker")
            .select("*", { count: "exact", head: true })
            .eq("screening_outcome", "Not Suitable");
        }
        
        rejected = rejectedResult.count || 0;
        if (rejectedResult.error) {
          console.error("Error fetching rejected count:", rejectedResult.error);
        }
      }

      // 8. Qualified: total rows in 'AEX_Screening_Tracker' with Screening_Outcome != 'Not Suitable'
      let qualified = 0;
      if (trackerData && trackerData.length > 0) {
        // Calculate from fetched data
        qualified = trackerData.filter((t: any) => {
          const outcome = t["Screening_Outcome"] ?? t["Screening Outcome"] ?? t.screening_outcome;
          return outcome && outcome.toString().trim() !== "Not Suitable" && outcome.toString().trim() !== "";
        }).length;
      } else {
        // Fallback: Try query approach
        let qualifiedResult = await supabase
          .from("AEX_Screening_Tracker")
          .select("*", { count: "exact", head: true })
          .neq("Screening_Outcome", "Not Suitable");
        
        if (qualifiedResult.error) {
          qualifiedResult = await supabase
            .from("AEX_Screening_Tracker")
            .select("*", { count: "exact", head: true })
            .neq("Screening Outcome", "Not Suitable");
        }
        
        if (qualifiedResult.error) {
          qualifiedResult = await supabase
            .from("AEX_Screening_Tracker")
            .select("*", { count: "exact", head: true })
            .neq("screening_outcome", "Not Suitable");
        }
        
        if (qualifiedResult.error) {
          qualifiedResult = await supabase
            .from("screening_tracker")
            .select("*", { count: "exact", head: true })
            .neq("screening_outcome", "Not Suitable");
        }
        
        qualified = qualifiedResult.count || 0;
      }

      // 9. Pass Rate: (Qualified/(Qualified+Rejected))*100
      const passRate = (qualified + rejected) > 0
        ? (qualified / (qualified + rejected)) * 100
        : 0;

      setAnalytics({
        totalApplications: totalApplications || 0,
        totalScreened: totalScreened || 0,
        averageScore: Math.round(averageScore * 10) / 10,
        pending: pending || 0,
        completed: completed || 0,
        noResponse: noResponse || 0,
        rejected,
        qualified,
        passRate: Math.round(passRate * 10) / 10,
      });
    } catch (error: any) {
      console.error("Error fetching PM Analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Applications",
      value: analytics.totalApplications || 0,
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Total Screened",
      value: analytics.totalScreened || 0,
      icon: Target,
      color: "text-accent",
    },
    {
      title: "Average Score",
      value: analytics.averageScore > 0 ? analytics.averageScore.toFixed(1) : "0",
      icon: Award,
      color: "text-status-success",
    },
    {
      title: "Pass Rate",
      value: analytics.passRate > 0 ? `${analytics.passRate.toFixed(1)}%` : "0%",
      icon: TrendingUp,
      color: "text-status-pending",
    },
  ];

  const statusCards = [
    {
      title: "Pending",
      value: analytics.pending || 0,
      icon: Clock,
      color: "text-status-pending",
    },
    {
      title: "Completed",
      value: analytics.completed || 0,
      icon: CheckCircle,
      color: "text-status-success",
    },
    {
      title: "No Response",
      value: analytics.noResponse || 0,
      icon: AlertCircle,
      color: "text-status-pending",
    },
    {
      title: "Rejected",
      value: analytics.rejected || 0,
      icon: XCircle,
      color: "text-status-rejected",
    },
    {
      title: "Qualified",
      value: analytics.qualified || 0,
      icon: CheckCircle,
      color: "text-status-success",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Awign Screening Tool</h2>
            <p className="text-muted-foreground mt-1">
              Analytics and metrics overview dashboard
            </p>
          </div>
          <Button onClick={fetchAnalytics} variant="outline" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {statusCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-foreground">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Screening Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Applications</span>
                  <span className="font-medium">{analytics.totalApplications}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "100%" }} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Screened</span>
                  <span className="font-medium">{analytics.totalScreened}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent"
                    style={{
                      width: `${
                        analytics.totalApplications > 0
                          ? (analytics.totalScreened / analytics.totalApplications) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Qualified</span>
                  <span className="font-medium">{analytics.qualified}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-status-success"
                    style={{
                      width: `${
                        (analytics.qualified + analytics.rejected) > 0
                          ? (analytics.qualified / (analytics.qualified + analytics.rejected)) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rejected</span>
                  <span className="font-medium">{analytics.rejected}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-status-rejected"
                    style={{
                      width: `${
                        (analytics.qualified + analytics.rejected) > 0
                          ? (analytics.rejected / (analytics.qualified + analytics.rejected)) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PMAnalytics;

