import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Briefcase, MapPin, Clock, Upload, FileSpreadsheet, RefreshCw, FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { JobDetailDialog } from "@/components/JobDetailDialog";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
// Using dynamic imports for better Vite compatibility with CommonJS modules

type Job = Tables<"AEX_Job_Data">;
type JobInsert = TablesInsert<"AEX_Job_Data">;

const Jobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jdFileInputRef = useRef<HTMLInputElement>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [uploadingJd, setUploadingJd] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    roleCode: "",
    roleName: "",
    status: "active",
    location: "",
    jdContext: "",
    currentUpdates: "",
    minimumExperience: "",
    duration: "",
    candidateMonthlyCtc: "",
    skills: "",
  });

  useEffect(() => {
    checkUserRole();
    fetchJobs();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        
        if (error) {
          console.error("Error checking user role:", error);
        } else {
          console.log("User roles:", roles);
          if (!roles || roles.length === 0) {
            console.warn("User has no roles assigned. Admin role is required to view data.");
            toast({
              title: "Permission Required",
              description: "You need an 'admin' role to view jobs. Please contact your administrator.",
              variant: "destructive",
            });
          }
        }
      }
    } catch (error) {
      console.error("Error in checkUserRole:", error);
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("AEX_Job_Data")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching jobs:", error);
        throw error;
      }
      
      console.log("Fetched jobs:", data?.length || 0, "jobs");
      setJobs(data || []);
      
      if (data && data.length === 0) {
        console.warn("No jobs found. This might be due to RLS policies. Make sure your user has 'admin' role assigned.");
      }
    } catch (error: any) {
      console.error("Error in fetchJobs:", error);
      toast({
        title: "Error fetching jobs",
        description: error.message || "Failed to fetch jobs. Please check if you have the required permissions (admin role).",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate required fields
      if (!formData.roleCode || !formData.roleCode.trim()) {
        toast({
          title: "Validation Error",
          description: "Role Code is required",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (!formData.roleName || !formData.roleName.trim()) {
        toast({
          title: "Validation Error",
          description: "Role Name is required",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (!formData.location || !formData.location.trim()) {
        toast({
          title: "Validation Error",
          description: "Location is required",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      if (!formData.candidateMonthlyCtc || !formData.candidateMonthlyCtc.trim()) {
        toast({
          title: "Validation Error",
          description: "Annual CTC is required",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate JD file is uploaded
      if (!jdFile) {
        toast({
          title: "Validation Error",
          description: "Please upload a JD file (.docx or .pdf)",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Upload JD file and get public URL
      let jdUrl: string;
      try {
        jdUrl = await uploadJdFile(jdFile);
      } catch (error: any) {
        toast({
          title: "Upload Error",
          description: error.message || "Failed to upload JD file. Please try again.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Check if Role Code already exists
      const { data: existingJob, error: checkError } = await supabase
        .from("AEX_Job_Data")
        .select('id, "Role Code"')
        .eq("Role Code", formData.roleCode.trim())
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is fine
        throw checkError;
      }

      if (existingJob) {
        toast({
          title: "Duplicate Role Code",
          description: `Job data with Role Code "${formData.roleCode}" already exists. Please use a different Role Code.`,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const annualCtc = formData.candidateMonthlyCtc.trim();

      const jobData: JobInsert = {
        "Role Code": formData.roleCode.trim(),
        "Role Name": formData.roleName.trim(),
        "Status": formData.status || "active",
        "Location": formData.location.trim(),
        "Brief context about the role (JD)": jdUrl,
        "Current Updates": formData.currentUpdates || null,
        "Minimum Experience": formData.minimumExperience || null,
        "Duration": formData.duration || null,
        "Candidate Monthly CTC": annualCtc,
        "Skills": formData.skills || null,
      };

      const { error } = await supabase.from("AEX_Job_Data").insert(jobData as any);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Job added successfully",
      });
      setDialogOpen(false);
      resetForm();
      fetchJobs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      roleCode: "",
      roleName: "",
      status: "active",
      location: "",
      jdContext: "",
      currentUpdates: "",
      minimumExperience: "",
      duration: "",
      candidateMonthlyCtc: "",
      skills: "",
    });
    setJdFile(null);
    if (jdFileInputRef.current) {
      jdFileInputRef.current.value = "";
    }
  };

  const convertDocxToPdf = async (file: File): Promise<Blob> => {
    try {
      // Load mammoth from CDN (avoids Vite CommonJS resolution issues)
      let mammoth: any;
      if (typeof window !== 'undefined' && (window as any).mammoth) {
        mammoth = (window as any).mammoth;
      } else {
        // Load mammoth from CDN
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.11.0/mammoth.browser.min.js';
          script.onload = () => {
            mammoth = (window as any).mammoth;
            resolve();
          };
          script.onerror = () => reject(new Error('Failed to load mammoth from CDN'));
          document.head.appendChild(script);
        });
      }
      
      // Load html2pdf from CDN (avoids Vite CommonJS resolution issues)
      let html2pdf: any;
      if (typeof window !== 'undefined' && (window as any).html2pdf) {
        html2pdf = (window as any).html2pdf;
      } else {
        // Load html2pdf from CDN
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.12.1/dist/html2pdf.bundle.min.js';
          script.onload = () => {
            html2pdf = (window as any).html2pdf;
            resolve();
          };
          script.onerror = () => reject(new Error('Failed to load html2pdf from CDN'));
          document.head.appendChild(script);
        });
      }

      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      // Create a temporary container for the HTML
      const container = document.createElement("div");
      container.innerHTML = html;
      container.style.padding = "20px";
      container.style.fontFamily = "Arial, sans-serif";

      // Convert HTML to PDF
      const opt = {
        margin: [10, 10, 10, 10],
        filename: file.name.replace(/\.[^/.]+$/, "") + ".pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      const pdfBlob = await html2pdf().set(opt).from(container).outputPdf("blob");
      return pdfBlob;
    } catch (error: any) {
      console.error("Error converting file to PDF:", error);
      throw new Error(`Failed to convert file to PDF: ${error.message}`);
    }
  };

  const uploadJdFile = async (file: File): Promise<string> => {
    try {
      setUploadingJd(true);
      
      // Convert docx to PDF (doc files are not supported by mammoth)
      let pdfBlob: Blob;
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      
      if (fileExtension === "docx") {
        pdfBlob = await convertDocxToPdf(file);
      } else if (fileExtension === "pdf") {
        pdfBlob = file;
      } else {
        throw new Error("Unsupported file format. Please upload a .docx or .pdf file.");
      }

      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_");
      const pdfFileName = `${sanitizedFileName}_${timestamp}.pdf`;
      const filePath = `Job_Data/${pdfFileName}`;

      // Get current user to ensure authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be logged in to upload files. Please log in and try again.");
      }

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("User_File_Uploads")
        .upload(filePath, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        // Provide helpful error message for RLS issues
        if (uploadError.message?.includes("new row violates row-level security") || 
            uploadError.message?.includes("row-level security") ||
            uploadError.message?.includes("policy") ||
            uploadError.statusCode === "403") {
          throw new Error(
            "Storage bucket RLS policy error. Please ensure:\n" +
            "1. The 'User_File_Uploads' bucket exists in Supabase Storage\n" +
            "2. RLS policies allow authenticated users to INSERT/UPDATE files\n" +
            "3. The bucket is configured to allow public access or has proper policies\n\n" +
            "See the console for more details."
          );
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("User_File_Uploads")
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error("Error uploading JD file:", error);
      throw error;
    } finally {
      setUploadingJd(false);
    }
  };

  const handleJdFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setJdFile(null);
      setFormData({ ...formData, jdContext: "" });
      return;
    }

    // Validate file type
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (!["docx", "pdf"].includes(fileExtension || "")) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a .docx or .pdf file.",
        variant: "destructive",
      });
      if (jdFileInputRef.current) {
        jdFileInputRef.current.value = "";
      }
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      if (jdFileInputRef.current) {
        jdFileInputRef.current.value = "";
      }
      return;
    }

    setJdFile(file);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCsv(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
      
      const columnMap: Record<string, string> = {
        "role code": "Role Code",
        "role_code": "Role Code",
        "role name": "Role Name",
        "role_name": "Role Name",
        "status": "Status",
        "location": "Location",
        "brief context about the role (jd)": "Brief context about the role (JD)",
        "jd context": "Brief context about the role (JD)",
        "jd_context": "Brief context about the role (JD)",
        "current updates": "Current Updates",
        "current_updates": "Current Updates",
        "minimum experience": "Minimum Experience",
        "minimum_experience": "Minimum Experience",
        "duration": "Duration",
        "candidate monthly ctc": "Candidate Monthly CTC",
        "candidate_monthly_ctc": "Candidate Monthly CTC",
        "skills": "Skills",
      };

      // Get all existing Role Codes from database
      const { data: existingJobs } = await supabase
        .from("AEX_Job_Data")
        .select('"Role Code"');
      
      const existingRoleCodes = new Set(
        (existingJobs || []).map(j => j["Role Code"]).filter((rc): rc is string => rc !== null)
      );

      const validRows: JobInsert[] = [];
      const resultRows: Array<{ originalLine: string; rowNumber: number; status: string; reason?: string; data?: any }> = [];
      const seenRoleCodes = new Set<string>();

      // Process each row individually
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;
        
        const row: any = {};
        headers.forEach((header, idx) => {
          const mappedKey = columnMap[header.toLowerCase()];
          if (mappedKey && values[idx]) {
            const value = values[idx].trim();
            row[mappedKey] = value || null;
          }
        });

        const rowNumber = i;
        const roleCode = row["Role Code"]?.trim();
        const roleName = row["Role Name"]?.trim();
        const location = row["Location"]?.trim();
        const jdContext = row["Brief context about the role (JD)"]?.trim();
        const candidateMonthlyCtc = row["Candidate Monthly CTC"]?.trim?.();

        // Validate required fields
        if (!roleCode) {
          resultRows.push({
            originalLine: lines[i],
            rowNumber,
            status: "INVALID",
            reason: "Missing Role Code",
            data: row,
          });
          toast({
            title: `Row ${rowNumber} Skipped`,
            description: "Missing required field: Role Code",
            variant: "destructive",
          });
          continue;
        }

        if (!roleName) {
          resultRows.push({
            originalLine: lines[i],
            rowNumber,
            status: "INVALID",
            reason: "Missing Role Name",
            data: row,
          });
          toast({
            title: `Row ${rowNumber} Skipped`,
            description: "Missing required field: Role Name",
            variant: "destructive",
          });
          continue;
        }

        if (!location) {
          resultRows.push({
            originalLine: lines[i],
            rowNumber,
            status: "INVALID",
            reason: "Missing Location",
            data: row,
          });
          toast({
            title: `Row ${rowNumber} Skipped`,
            description: "Missing required field: Location",
            variant: "destructive",
          });
          continue;
        }

        if (!jdContext) {
          resultRows.push({
            originalLine: lines[i],
            rowNumber,
            status: "INVALID",
            reason: "Missing Brief context about the role (JD)",
            data: row,
          });
          toast({
            title: `Row ${rowNumber} Skipped`,
            description: "Missing required field: Brief context about the role (JD)",
            variant: "destructive",
          });
          continue;
        }

        // Validate JD is a valid URL
        try {
          const urlObj = new URL(jdContext);
          if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
            resultRows.push({
              originalLine: lines[i],
              rowNumber,
              status: "INVALID",
              reason: "JD must be a valid file URL (http:// or https://)",
              data: row,
            });
            toast({
              title: `Row ${rowNumber} Skipped`,
              description: "Brief context about the role (JD) must be a valid file URL (http:// or https://)",
              variant: "destructive",
            });
            continue;
          }
        } catch {
          resultRows.push({
            originalLine: lines[i],
            rowNumber,
            status: "INVALID",
            reason: "JD must be a valid file URL (http:// or https://)",
            data: row,
          });
          toast({
            title: `Row ${rowNumber} Skipped`,
            description: "Brief context about the role (JD) must be a valid file URL (http:// or https://)",
            variant: "destructive",
          });
          continue;
        }

        if (!candidateMonthlyCtc) {
          resultRows.push({
            originalLine: lines[i],
            rowNumber,
            status: "INVALID",
            reason: "Missing Annual CTC",
            data: row,
          });
          toast({
            title: `Row ${rowNumber} Skipped`,
            description: "Missing required field: Annual CTC",
            variant: "destructive",
          });
          continue;
        }

        // Check for duplicate Role Code within CSV
        if (seenRoleCodes.has(roleCode)) {
          resultRows.push({
            originalLine: lines[i],
            rowNumber,
            status: "DUPLICATE_IN_CSV",
            reason: `Role Code "${roleCode}" already exists in this CSV file`,
            data: row,
          });
          toast({
            title: `Row ${rowNumber} Skipped`,
            description: `Duplicate Role Code "${roleCode}" found in CSV`,
            variant: "destructive",
          });
          continue;
        }

        // Check if Role Code already exists in database
        if (existingRoleCodes.has(roleCode)) {
          resultRows.push({
            originalLine: lines[i],
            rowNumber,
            status: "ALREADY_EXISTS",
            reason: `Role Code "${roleCode}" already exists in database`,
            data: row,
          });
          toast({
            title: `Row ${rowNumber} Skipped`,
            description: `Role Code "${roleCode}" already exists in database`,
            variant: "destructive",
          });
          continue;
        }

        // Row is valid
        seenRoleCodes.add(roleCode);
        validRows.push(row as JobInsert);
        resultRows.push({
          originalLine: lines[i],
          rowNumber,
          status: "SUCCESS",
          data: row,
        });
      }

      if (validRows.length === 0) {
        toast({
          title: "No Valid Rows",
          description: "No valid rows found to insert. All rows were skipped due to validation errors or duplicates.",
          variant: "destructive",
        });
        setUploadingCsv(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
          // Insert valid rows
      const { error } = await supabase.from("AEX_Job_Data").insert(validRows as any);

      if (error) throw error;

      // Generate result CSV with status column
      const resultCsvLines: string[] = [];
      resultCsvLines.push(`"Row Number","Status","Reason",${headers.map(h => `"${h}"`).join(",")}`);
      
      resultRows.forEach((result) => {
        const statusColor = result.status === "INVALID" ? "RED" : result.status === "ALREADY_EXISTS" || result.status === "DUPLICATE_IN_CSV" ? "YELLOW" : "GREEN";
        const reason = result.reason || "Successfully inserted";
        const originalValues = parseCSVLine(result.originalLine);
        resultCsvLines.push(`"${result.rowNumber}","${result.status} (${statusColor})","${reason}",${originalValues.map(v => `"${v}"`).join(",")}`);
      });

      const resultCsv = resultCsvLines.join("\n");
      const blob = new Blob([resultCsv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `job_upload_result_${new Date().getTime()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const invalidCount = resultRows.filter(r => r.status === "INVALID").length;
      const duplicateCount = resultRows.filter(r => r.status === "ALREADY_EXISTS" || r.status === "DUPLICATE_IN_CSV").length;
      const successCount = validRows.length;

      toast({
        title: "Upload Complete",
        description: `${successCount} job(s) inserted successfully. ${invalidCount} invalid, ${duplicateCount} duplicate. Result CSV downloaded.`,
      });
      setDialogOpen(false);
      fetchJobs();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingCsv(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "active":
        return "default";
      case "paused":
        return "secondary";
      case "closed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Jobs</h1>
          <p className="text-muted-foreground text-base">Manage job openings and requirements</p>
        </div>
        <div className="flex items-center gap-2">
          <Card className="border-border/50">
            <CardContent className="px-4 py-2.5">
              <div className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{jobs.length}</span>
              </div>
            </CardContent>
          </Card>
          <Button onClick={fetchJobs} variant="outline" size="sm" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Job
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Job</DialogTitle>
              <DialogDescription>Add a single job or upload multiple via CSV</DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="form" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="form">
                  <Plus className="h-4 w-4 mr-2" />
                  Single Entry
                </TabsTrigger>
                <TabsTrigger value="csv">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Bulk Upload
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="form" className="mt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="roleCode">Role Code *</Label>
                      <Input
                        id="roleCode"
                        value={formData.roleCode}
                        onChange={(e) => setFormData({ ...formData, roleCode: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roleName">Role Name *</Label>
                      <Input
                        id="roleName"
                        value={formData.roleName}
                        onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location *</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minimumExperience">Minimum Experience</Label>
                      <Input
                        id="minimumExperience"
                        value={formData.minimumExperience}
                        onChange={(e) => setFormData({ ...formData, minimumExperience: e.target.value })}
                        placeholder="e.g., 3 years"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration</Label>
                      <Input
                        id="duration"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        placeholder="e.g., 6 months"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="candidateMonthlyCtc">Annual CTC *</Label>
                    <Input
                      id="candidateMonthlyCtc"
                      value={formData.candidateMonthlyCtc}
                      onChange={(e) => setFormData({ ...formData, candidateMonthlyCtc: e.target.value })}
                      placeholder="e.g., 50000"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skills">Skills</Label>
                    <Input
                      id="skills"
                      value={formData.skills}
                      onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                      placeholder="React, TypeScript, Node.js"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jdFile">Brief context about the role (JD) *</Label>
                    <div className="space-y-2">
                      <input
                        ref={jdFileInputRef}
                        type="file"
                        id="jdFile"
                        accept=".docx,.pdf"
                        onChange={handleJdFileChange}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => jdFileInputRef.current?.click()}
                          disabled={uploadingJd || submitting}
                          className="flex-1"
                        >
                          {uploadingJd ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              {jdFile ? "Change File" : "Upload JD File"}
                            </>
                          )}
                        </Button>
                        {jdFile && !uploadingJd && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setJdFile(null);
                              if (jdFileInputRef.current) {
                                jdFileInputRef.current.value = "";
                              }
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {jdFile && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground truncate flex-1">
                            {jdFile.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {(jdFile.size / 1024).toFixed(2)} KB
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Upload a .docx or .pdf file (max 10MB). .docx files will be converted to PDF automatically.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentUpdates">Current Updates</Label>
                    <Input
                      id="currentUpdates"
                      value={formData.currentUpdates}
                      onChange={(e) => setFormData({ ...formData, currentUpdates: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting || uploadingJd}>
                    {(submitting || uploadingJd) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {uploadingJd ? "Uploading JD..." : submitting ? "Adding Job..." : "Add Job"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="csv" className="mt-4">
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50/30 hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                    <Upload className="h-12 w-12 mx-auto text-blue-600 mb-4" />
                    <h3 className="text-lg font-semibold mb-2 text-blue-800">Upload CSV File</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload a CSV file with job data. Required columns:
                    </p>
                    <p className="text-xs text-muted-foreground mb-2 font-mono bg-muted p-2 rounded">
                      Required columns: Role Code*, Role Name*, Location*, Brief context about the role (JD)*
                    </p>
                    <p className="text-xs text-muted-foreground mb-4 font-mono bg-muted p-2 rounded">
                      Optional columns: Status, Current Updates, Minimum Experience, Duration, Annual CTC, Skills
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      *Brief context about the role (JD) must be a valid file URL (http:// or https://)
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                      id="csv-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingCsv}
                    >
                      {uploadingCsv ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Select CSV File
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job, index) => (
          <Card
            key={job.id}
            className="border-blue-200/60 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer group overflow-hidden"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedJob(job);
              setDetailDialogOpen(true);
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <CardHeader className="pb-4 relative z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 mt-0.5 flex-shrink-0 shadow-sm border border-blue-200/50">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-bold line-clamp-2 mb-1.5 group-hover:text-blue-700 transition-colors">
                      {job["Role Name"] || "—"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono truncate bg-blue-50 px-2 py-0.5 rounded-md inline-block border border-blue-200/50">
                      {job["Role Code"] || "—"}
                    </p>
                  </div>
                </div>
                <Badge variant={getStatusColor(job["Status"])} className="flex-shrink-0 shadow-sm">
                  {job["Status"] || "N/A"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 relative z-10">
              {job["Location"] && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-blue-600" />
                  <span className="truncate">{job["Location"]}</span>
                </div>
              )}
              {job["Minimum Experience"] && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0 text-blue-600" />
                  <span>{job["Minimum Experience"]}</span>
                </div>
              )}
              {job["Skills"] && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {job["Skills"].split(",").slice(0, 3).map((skill, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs font-medium border-blue-300 bg-blue-50/50 text-blue-700">
                      {skill.trim()}
                    </Badge>
                  ))}
                  {job["Skills"].split(",").length > 3 && (
                    <Badge variant="outline" className="text-xs font-medium border-blue-300 bg-blue-50/50 text-blue-700">
                      +{job["Skills"].split(",").length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {jobs.length === 0 && (
        <Card className="border-blue-200/60 shadow-lg bg-gradient-to-br from-card to-blue-50/30">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 mb-6 shadow-lg shadow-blue-500/10 border border-blue-200/50">
              <Briefcase className="h-10 w-10 text-blue-700" />
            </div>
            <h3 className="text-2xl font-bold text-blue-800 mb-2">No jobs yet</h3>
            <p className="text-base text-muted-foreground text-center max-w-md">
              Start by adding your first job opening to get started with the screening process
            </p>
          </CardContent>
        </Card>
      )}

      <JobDetailDialog
        job={selectedJob}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onUpdated={fetchJobs}
      />
    </div>
  );
};

export default Jobs;
