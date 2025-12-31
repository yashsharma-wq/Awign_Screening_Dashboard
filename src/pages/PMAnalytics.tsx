import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, Users, Target, Award, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

type TimeFilter = "today" | "weekly" | "monthly" | "all";

const PMAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
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

  // Get date range based on filter
  const getDateRange = (filter: TimeFilter) => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    switch (filter) {
      case "today":
        return {
          start: startOfDay.toISOString(),
          end: now.toISOString(),
        };
      case "weekly":
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);
        startOfWeek.setHours(0, 0, 0, 0);
        return {
          start: startOfWeek.toISOString(),
          end: now.toISOString(),
        };
      case "monthly":
        const startOfMonth = new Date(now);
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        return {
          start: startOfMonth.toISOString(),
          end: now.toISOString(),
        };
      case "all":
      default:
        return null; // No date filter
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeFilter]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      const dateRange = getDateRange(timeFilter);
      let applicationsQuery = supabase
        .from("AEX_Candidate_Data")
        .select("*", { count: "exact", head: true });
      
      let screenedQuery = supabase
        .from("AEX_Screening_Batch_Queue")
        .select("*", { count: "exact", head: true });

      // Apply date filter if not "all"
      if (dateRange) {
        applicationsQuery = applicationsQuery
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end);
        
        screenedQuery = screenedQuery
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end);
      }

      // 1. Total Applications: total rows in 'AEX_Candidate_Data'
      const { count: totalApplications, error: applicationsError } = await applicationsQuery;

      if (applicationsError) {
        console.error("Error fetching applications count:", applicationsError);
      }

      // 2. Total Screened: total rows in 'AEX_Screening_Batch_Queue'
      const { count: totalScreened, error: screenedError } = await screenedQuery;

      if (screenedError) {
        console.error("Error fetching screened count:", screenedError);
      }

      // 3. Average Score: average of 'Final Score' in 'AEX_Screening_Tracker'
      let trackerData: any[] | null = null;
      
      let trackerResult = supabase
        .from("AEX_Screening_Tracker")
        .select("*");
      
      // Apply date filter if not "all"
      if (dateRange) {
        trackerResult = trackerResult
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end);
      }
      
      let result = await trackerResult;
      
      if (result.error) {
        // Fallback to lowercase table name
        let fallbackResult = supabase
          .from("screening_tracker")
          .select("*");
        
        if (dateRange) {
          fallbackResult = fallbackResult
            .gte("created_at", dateRange.start)
            .lte("created_at", dateRange.end);
        }
        
        result = await fallbackResult;
      }
      
      trackerData = result.data || null;

      if (result.error) {
        console.error("Error fetching tracker data:", result.error);
      }
      
      // Always filter by date range if specified (double-check to ensure accuracy)
      if (dateRange && trackerData && trackerData.length > 0) {
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        
        trackerData = trackerData.filter((item: any) => {
          // Try multiple date fields
          const itemDate = item.created_at || item.timestamp;
          if (!itemDate) return false;
          
          const itemDateObj = new Date(itemDate);
          // Set time to start of day for comparison
          itemDateObj.setHours(0, 0, 0, 0);
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          
          return itemDateObj >= start && itemDateObj <= end;
        });
      }

      // Calculate average score from tracker data (already filtered by date)
      let averageScore = 0;
      if (trackerData && trackerData.length > 0) {
        const scores = trackerData
          .map((t: any) => {
            // Verify date matches filter first
            if (dateRange) {
              const itemDate = t.created_at || t.timestamp;
              if (!itemDate) return null;
              
              const itemDateObj = new Date(itemDate);
              itemDateObj.setHours(0, 0, 0, 0);
              const startDate = new Date(dateRange.start);
              startDate.setHours(0, 0, 0, 0);
              const endDate = new Date(dateRange.end);
              endDate.setHours(23, 59, 59, 999);
              
              if (itemDateObj < startDate || itemDateObj > endDate) {
                return null;
              }
            }
            
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
      let pendingQuery = supabase
        .from("AEX_Candidate_Data")
        .select("*", { count: "exact", head: true })
        .eq("JD_Mapping", "NOT STARTED");
      
      if (dateRange) {
        pendingQuery = pendingQuery
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end);
      }
      
      const { count: pending, error: pendingError } = await pendingQuery;

      if (pendingError) {
        console.error("Error fetching pending count:", pendingError);
      }

      // 5. Completed: total rows in 'AEX_Screening_Batch_Queue' with Status='Completed'
      let completedQuery = supabase
        .from("AEX_Screening_Batch_Queue")
        .select("*", { count: "exact", head: true })
        .eq("Status", "Completed");
      
      if (dateRange) {
        completedQuery = completedQuery
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end);
      }
      
      const { count: completed, error: completedError } = await completedQuery;
      
      if (completedError) {
        console.error("Error fetching completed count:", completedError);
      }

      // 6. No Response: total rows in 'AEX_Screening_Batch_Queue' with Status='Waiting'
      let noResponseQuery = supabase
        .from("AEX_Screening_Batch_Queue")
        .select("*", { count: "exact", head: true })
        .eq("Status", "Waiting");
      
      if (dateRange) {
        noResponseQuery = noResponseQuery
          .gte("created_at", dateRange.start)
          .lte("created_at", dateRange.end);
      }
      
      const { count: noResponse, error: noResponseError } = await noResponseQuery;
      
      if (noResponseError) {
        console.error("Error fetching no response count:", noResponseError);
      }

      // 7. Rejected: total rows in 'AEX_Screening_Tracker' with Screening_Outcome='Not Suitable'
      let rejected = 0;
      
      // Always calculate from fetched tracker data (already filtered by date)
      if (trackerData && trackerData.length > 0) {
        // Double-check date filter for rejected entries
        let filteredRejected = trackerData.filter((t: any) => {
          const outcome = t["Screening_Outcome"] ?? t["Screening Outcome"] ?? t.screening_outcome;
          if (!outcome || outcome.toString().trim() !== "Not Suitable") {
            return false;
          }
          
          // Verify date matches filter
          if (dateRange) {
            const itemDate = t.created_at || t.timestamp;
            if (!itemDate) return false;
            
            const itemDateObj = new Date(itemDate);
            itemDateObj.setHours(0, 0, 0, 0);
            const startDate = new Date(dateRange.start);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            
            return itemDateObj >= startDate && itemDateObj <= endDate;
          }
          
          return true;
        });
        
        rejected = filteredRejected.length;
      } else {
        // Fallback: Try count queries with different column name formats
        let rejectedResult = supabase
          .from("AEX_Screening_Tracker")
          .select("*", { count: "exact", head: true })
          .eq("Screening_Outcome", "Not Suitable");
        
        // Apply date filter if not "all"
        if (dateRange) {
          rejectedResult = rejectedResult
            .gte("created_at", dateRange.start)
            .lte("created_at", dateRange.end);
        }
        
        let result = await rejectedResult;
        
        if (result.error) {
          // Try with space in column name
          let rejectedResult2 = supabase
            .from("AEX_Screening_Tracker")
            .select("*", { count: "exact", head: true })
            .eq("Screening Outcome", "Not Suitable");
          
          if (dateRange) {
            rejectedResult2 = rejectedResult2
              .gte("created_at", dateRange.start)
              .lte("created_at", dateRange.end);
          }
          
          result = await rejectedResult2;
        }
        
        if (result.error) {
          // Try snake_case column name
          let rejectedResult3 = supabase
            .from("AEX_Screening_Tracker")
            .select("*", { count: "exact", head: true })
            .eq("screening_outcome", "Not Suitable");
          
          if (dateRange) {
            rejectedResult3 = rejectedResult3
              .gte("created_at", dateRange.start)
              .lte("created_at", dateRange.end);
          }
          
          result = await rejectedResult3;
        }
        
        if (result.error) {
          // Try lowercase table name
          let rejectedResult4 = supabase
            .from("screening_tracker")
            .select("*", { count: "exact", head: true })
            .eq("screening_outcome", "Not Suitable");
          
          if (dateRange) {
            rejectedResult4 = rejectedResult4
              .gte("created_at", dateRange.start)
              .lte("created_at", dateRange.end);
          }
          
          result = await rejectedResult4;
        }
        
        rejected = result.count || 0;
        if (result.error) {
          console.error("Error fetching rejected count:", result.error);
        }
      }

      // 8. Qualified: total rows in 'AEX_Screening_Tracker' with Screening_Outcome != 'Not Suitable'
      let qualified = 0;
      if (trackerData && trackerData.length > 0) {
        // Calculate from fetched data with date verification
        let filteredQualified = trackerData.filter((t: any) => {
          const outcome = t["Screening_Outcome"] ?? t["Screening Outcome"] ?? t.screening_outcome;
          if (!outcome || outcome.toString().trim() === "Not Suitable" || outcome.toString().trim() === "") {
            return false;
          }
          
          // Verify date matches filter
          if (dateRange) {
            const itemDate = t.created_at || t.timestamp;
            if (!itemDate) return false;
            
            const itemDateObj = new Date(itemDate);
            itemDateObj.setHours(0, 0, 0, 0);
            const startDate = new Date(dateRange.start);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            
            return itemDateObj >= startDate && itemDateObj <= endDate;
          }
          
          return true;
        });
        
        qualified = filteredQualified.length;
      } else {
        // Fallback: Try query approach
        let qualifiedResult = supabase
          .from("AEX_Screening_Tracker")
          .select("*", { count: "exact", head: true })
          .neq("Screening_Outcome", "Not Suitable");
        
        // Apply date filter if not "all"
        if (dateRange) {
          qualifiedResult = qualifiedResult
            .gte("created_at", dateRange.start)
            .lte("created_at", dateRange.end);
        }
        
        let result = await qualifiedResult;
        
        if (result.error) {
          let qualifiedResult2 = supabase
            .from("AEX_Screening_Tracker")
            .select("*", { count: "exact", head: true })
            .neq("Screening Outcome", "Not Suitable");
          
          if (dateRange) {
            qualifiedResult2 = qualifiedResult2
              .gte("created_at", dateRange.start)
              .lte("created_at", dateRange.end);
          }
          
          result = await qualifiedResult2;
        }
        
        if (result.error) {
          let qualifiedResult3 = supabase
            .from("AEX_Screening_Tracker")
            .select("*", { count: "exact", head: true })
            .neq("screening_outcome", "Not Suitable");
          
          if (dateRange) {
            qualifiedResult3 = qualifiedResult3
              .gte("created_at", dateRange.start)
              .lte("created_at", dateRange.end);
          }
          
          result = await qualifiedResult3;
        }
        
        if (result.error) {
          let qualifiedResult4 = supabase
            .from("screening_tracker")
            .select("*", { count: "exact", head: true })
            .neq("screening_outcome", "Not Suitable");
          
          if (dateRange) {
            qualifiedResult4 = qualifiedResult4
              .gte("created_at", dateRange.start)
              .lte("created_at", dateRange.end);
          }
          
          result = await qualifiedResult4;
        }
        
        qualified = result.count || 0;
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
          <div className="flex items-center gap-4">
            <Tabs value={timeFilter} onValueChange={(value) => setTimeFilter(value as TimeFilter)}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={fetchAnalytics} variant="outline" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
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

