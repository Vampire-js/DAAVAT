"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNote } from "@/app/contexts/NotesContext";
import { Loader2, FileText, Copy, CheckCircle2, PlusCircle } from "lucide-react";

type ApiResponse = {
  status: string;
  summary_markdown: string;
  original_word_count: number;
  summary_word_count: number;
  error?: string;
};

export default function PdfSummarizer() {
  const { addReference } = useNote();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.type !== "application/pdf") {
      alert("Please upload a PDF file");
      return;
    }
    setPdfFile(file);
    setResult(null);
  };

  const sendToAPI = async () => {
    if (!pdfFile) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", pdfFile);

    try {
      const res = await fetch("http://127.0.0.1:8000/pdf_summarize", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data as ApiResponse);
    } catch (err) {
      console.error("PDF Summarization failed:", err);
      alert("Failed to connect to the summarizer.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToNote = () => {
    if (!result) return;
    addReference({
      source: "PDF",
      title: pdfFile?.name || "Uploaded PDF",
      content: result.summary_markdown
    });
    alert("Added to references!");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-5 text-sm text-neutral-300">
      <h2 className="font-semibold text-lg text-white flex items-center gap-2">
        <FileText className="text-orange-500" /> PDF Summarizer
      </h2>
      <p className="text-neutral-400">
        Upload a PDF to get a 35% density summary.
      </p>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* File Selection UI */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          {pdfFile ? "Change PDF" : "Upload PDF"}
        </Button>
        {pdfFile && <span className="self-center text-xs truncate max-w-[150px]">{pdfFile.name}</span>}
      </div>

      <Button
        disabled={!pdfFile || loading}
        onClick={sendToAPI}
        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing PDF...
          </>
        ) : (
          "Generate Summary"
        )}
      </Button>

      {/* Result UI */}
      {result && (
        <div className="space-y-4 border border-neutral-800 rounded-lg p-4 bg-neutral-900 mt-4 animate-in fade-in slide-in-from-bottom-2">
          
          <div className="flex justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-2">
            <span>Original: {result.original_word_count.toLocaleString()} words</span>
            <span className="text-orange-400 font-medium">Summary: {result.summary_word_count.toLocaleString()} words</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-white font-medium">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-500"/> Report
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddToNote}
                  className="border-orange-500 text-orange-500 hover:bg-orange-500/10 text-xs h-8"
                >
                  <PlusCircle size={14} className="mr-1"/> Add to References
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-8"
                  onClick={() => copyToClipboard(result.summary_markdown)}
                >
                  <Copy size={14} className="mr-1"/> Copy MD
                </Button>
              </div>
            </div>
            
            <div className="text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto bg-neutral-950 p-3 rounded-md border border-neutral-800 font-mono text-xs">
              {result.summary_markdown}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}