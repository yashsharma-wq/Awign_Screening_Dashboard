import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, Upload } from "lucide-react";

type UploadedFileInfo = {
  name: string;
  url: string;
};

type UploadTarget = "jd" | "resume";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const Uploader = () => {
  const [activeTarget, setActiveTarget] = useState<UploadTarget>("jd");
  const [uploadingTarget, setUploadingTarget] = useState<UploadTarget | null>(null);
  const [jdUploads, setJdUploads] = useState<UploadedFileInfo[]>([]);
  const [resumeUploads, setResumeUploads] = useState<UploadedFileInfo[]>([]);

  const jdInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Public URL copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard. Please try manually.",
        variant: "destructive",
      });
    }
  };

  const sanitizeFileName = (name: string) =>
    name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_");

  const convertDocToPdf = async (file: File): Promise<Blob> => {
    try {
      let mammoth: any;
      if (typeof window !== "undefined" && (window as any).mammoth) {
        mammoth = (window as any).mammoth;
      } else {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/mammoth@1.11.0/mammoth.browser.min.js";
          script.onload = () => {
            mammoth = (window as any).mammoth;
            resolve();
          };
          script.onerror = () => reject(new Error("Failed to load mammoth from CDN"));
          document.head.appendChild(script);
        });
      }

      let html2pdf: any;
      if (typeof window !== "undefined" && (window as any).html2pdf) {
        html2pdf = (window as any).html2pdf;
      } else {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.12.1/dist/html2pdf.bundle.min.js";
          script.onload = () => {
            html2pdf = (window as any).html2pdf;
            resolve();
          };
          script.onerror = () => reject(new Error("Failed to load html2pdf from CDN"));
          document.head.appendChild(script);
        });
      }

      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      const container = document.createElement("div");
      container.innerHTML = html;
      container.style.padding = "20px";
      container.style.fontFamily = "Arial, sans-serif";

      const opt = {
        margin: 0.5,
        filename: `${sanitizeFileName(file.name)}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      };

      const pdfBlob: Blob = await html2pdf().from(container).set(opt).outputPdf("blob");
      return pdfBlob;
    } catch (error: any) {
      console.error("Error converting file to PDF:", error);
      throw new Error(error?.message || "Failed to convert file to PDF");
    }
  };

  const ensurePdfBlob = async (file: File): Promise<Blob> => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "pdf") return file;
    if (extension === "doc" || extension === "docx") {
      return convertDocToPdf(file);
    }
    throw new Error("Unsupported file type. Please upload .doc, .docx, or .pdf files.");
  };

  const uploadFile = async (file: File, folder: string) => {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File "${file.name}" is too large. Max 10MB allowed.`);
    }

    const pdfBlob = await ensurePdfBlob(file);
    const timestamp = Date.now();
    const filePath = `${folder}/${sanitizeFileName(file.name)}_${timestamp}.pdf`;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("You must be logged in to upload files. Please log in and try again.");
    }

    const { error: uploadError } = await supabase.storage
      .from("User_File_Uploads")
      .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage.from("User_File_Uploads").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleFilesSelected = async (fileList: FileList | null, target: UploadTarget) => {
    if (!fileList || fileList.length === 0) return;

    const folder = target === "jd" ? "Job_Data" : "Candidate_Data";
    setUploadingTarget(target);

    try {
      const files = Array.from(fileList);
      const uploaded: UploadedFileInfo[] = [];

      for (const file of files) {
        const url = await uploadFile(file, folder);
        uploaded.push({ name: file.name, url });
      }

      if (target === "jd") {
        setJdUploads((prev) => [...uploaded, ...prev]);
      } else {
        setResumeUploads((prev) => [...uploaded, ...prev]);
      }

      toast({
        title: "Upload complete",
        description: `${uploaded.length} file(s) uploaded successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingTarget(null);
      if (target === "jd" && jdInputRef.current) jdInputRef.current.value = "";
      if (target === "resume" && resumeInputRef.current) resumeInputRef.current.value = "";
    }
  };

  const renderUploadSection = (target: UploadTarget) => {
    const isUploading = uploadingTarget === target;
    const uploads = target === "jd" ? jdUploads : resumeUploads;
    const inputRef = target === "jd" ? jdInputRef : resumeInputRef;
    const title = target === "jd" ? "JD Upload" : "Resume Upload";
    const description =
      target === "jd"
        ? "Upload .doc/.docx/.pdf files for job descriptions. Files are converted to PDF and stored under Job_Data."
        : "Upload .doc/.docx/.pdf files for candidate resumes. Files are converted to PDF and stored under Candidate_Data.";

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".doc,.docx,.pdf"
              multiple
              onChange={(e) => handleFilesSelected(e.target.files, target)}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="w-full sm:w-auto"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Select Files
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              Supports .doc, .docx, .pdf (max 10MB each). Files are stored individually.
            </p>
          </div>

          {uploads.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-medium text-foreground">Filename</th>
                    <th className="px-4 py-2 font-medium text-foreground">File URL</th>
                    <th className="px-4 py-2 font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((item) => (
                    <tr key={`${item.name}-${item.url}`} className="border-t border-border/50">
                      <td className="px-4 py-2 text-foreground">{item.name}</td>
                      <td className="px-4 py-2">
                        <span className="block truncate text-blue-600 hover:underline">
                          <a href={item.url} target="_blank" rel="noreferrer">
                            {item.url}
                          </a>
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleCopy(item.url)}
                          title="Copy public URL"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Bulk Upload</h1>
          <p className="text-muted-foreground text-base">
            Upload and convert JD or Resume files to PDF. Files are stored in Supabase storage and exposed via public URLs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTarget === "jd" ? "default" : "outline"}
            onClick={() => setActiveTarget("jd")}
          >
            JD Upload
          </Button>
          <Button
            variant={activeTarget === "resume" ? "default" : "outline"}
            onClick={() => setActiveTarget("resume")}
          >
            Resume Upload
          </Button>
        </div>
      </div>

      {activeTarget === "jd" ? renderUploadSection("jd") : renderUploadSection("resume")}
    </div>
  );
};

export default Uploader;









