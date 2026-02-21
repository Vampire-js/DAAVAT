"use client";

import { useState, useRef } from "react";
import { useNote } from "@/app/contexts/NotesContext"; // Added import
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Youtube, 
  Loader2, 
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  Cookie, 
  FileText, 
  AlignLeft,
  Check,
  Plus // Added icon for the new button
} from "lucide-react";
import ReactMarkdown from 'react-markdown';

type ApiResponse = {
  transcript: string;
  notes: string;
  image_url: string | null;
  error?: string;
};

type ModelSize = "small" | "medium" | "large";

export default function YouTubeSummarizer() {
  const { addReference } = useNote(); // Access the new context helper
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [modelSize, setModelSize] = useState<ModelSize>("medium");
  const [copied, setCopied] = useState(false);
  
  // Cookie Upload States
  const [cookieStatus, setCookieStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSummarize = async () => {
    if (!url) return;

    setLoading(true);
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch("http://127.0.0.1:8000/youtube_summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, model_size: modelSize }),
      });

      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setResult(data);
    } catch (err: any) {
      console.error("YouTube Error:", err);
      if (err.message.includes("403") || err.message.includes("Forbidden") || err.message.includes("cookies")) {
        setErrorMsg("YouTube blocked this request (403). Please upload a FRESH 'cookies.txt' file using the button above.");
      } else if (err.message.includes("empty")) {
        setErrorMsg("Download failed (Empty File). Try uploading fresh cookies or check if the video is Age Restricted.");
      } else {
        setErrorMsg(err.message || "Failed to process video.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddToNote = () => {
    if (!result) return;
    
    addReference({
      source: "YouTube",
      title: url.split('v=')[1] || "YouTube Video",
      content: result.notes 
    });
    
    alert("Added to references at the bottom of the note!");
  };

  const handleCookieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCookieStatus("uploading");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/upload_cookies", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setCookieStatus("success");
      setTimeout(() => setCookieStatus("idle"), 3000); 
    } catch (err) {
      console.error("Cookie Upload Error:", err);
      setCookieStatus("error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full max-h-[85vh]">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-lg text-white flex items-center gap-2">
          <Youtube className="text-red-500" /> YouTube Summarizer
        </h2>
        
        <div>
          <input 
            type="file" 
            accept=".txt" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleCookieUpload}
          />
          <Button 
            variant="outline" 
            size="sm" 
            className="border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 text-xs h-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={cookieStatus === "uploading"}
          >
            {cookieStatus === "uploading" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
            ) : cookieStatus === "success" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mr-2" />
            ) : (
              <Cookie className="w-3.5 h-3.5 mr-2" />
            )}
            {cookieStatus === "success" ? "Cookies Updated!" : "Upload Cookies"}
          </Button>
        </div>
      </div>

      {/* INPUT SECTION */}
      <div className="space-y-4 shrink-0">
        <div className="flex flex-col gap-2 p-3 border border-neutral-800 rounded-md bg-neutral-900/50">
          <label className="text-xs font-medium text-neutral-400 flex justify-between">
            <span>Model Accuracy</span>
            <span className={`font-bold uppercase ${
              modelSize === "small" ? "text-green-400" : modelSize === "medium" ? "text-yellow-400" : "text-red-400"
            }`}>{modelSize}</span>
          </label>
          <input 
              type="range" 
              min="0" 
              max="2" 
              step="1" 
              value={modelSize === "small" ? 0 : modelSize === "medium" ? 1 : 2}
              onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setModelSize(val === 0 ? "small" : val === 1 ? "medium" : "large");
              }}
              className="w-full accent-red-500 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-neutral-500 uppercase font-bold tracking-wider">
              <span>Fast</span>
              <span>Balanced</span>
              <span>Detailed</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-600 focus-visible:ring-red-500"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button 
            onClick={handleSummarize} 
            disabled={!url || loading}
            className="bg-red-600 hover:bg-red-700 text-white min-w-[100px]"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Summarize"}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="shrink-0 bg-red-950/30 border border-red-900/50 p-3 rounded-md flex items-start gap-3 text-red-200 animate-in fade-in zoom-in-95">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Action Required</p>
            <p className="text-xs opacity-90 mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* RESULT TABS */}
      {result && (
        <div className="flex-1 min-h-0 flex flex-col border border-neutral-800 bg-neutral-900/30 rounded-lg animate-in fade-in slide-in-from-bottom-2 overflow-hidden w-full">
          <Tabs defaultValue="notes" className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between p-2 border-b border-neutral-800 bg-neutral-950/50 shrink-0">
              <TabsList className="bg-transparent p-0 gap-4 h-auto">
                <TabsTrigger 
                  value="notes" 
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-red-500 text-neutral-500 border-b-2 border-transparent data-[state=active]:border-red-500 rounded-none px-1 pb-2"
                >
                  <FileText className="w-4 h-4 mr-2" /> Notes
                </TabsTrigger>
                <TabsTrigger 
                  value="transcript" 
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-red-500 text-neutral-500 border-b-2 border-transparent data-[state=active]:border-red-500 rounded-none px-1 pb-2"
                >
                  <AlignLeft className="w-4 h-4 mr-2" /> Transcript
                </TabsTrigger>
              </TabsList>
              
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-neutral-400 hover:text-white"
                  onClick={handleAddToNote}
                >
                  <Plus className="w-3.5 h-3.5 mr-1"/> Add to References
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs text-neutral-400 hover:text-white"
                  onClick={() => copyToClipboard(result.notes || result.transcript)}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-500 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1"/>}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            
            <TabsContent value="notes" className="flex-1 overflow-y-auto p-4 m-0 data-[state=inactive]:hidden w-full">
              <div className="prose prose-invert prose-sm max-w-none w-full break-words prose-pre:whitespace-pre-wrap prose-pre:break-words prose-headings:text-neutral-200 prose-p:text-neutral-400 prose-strong:text-neutral-300 prose-li:text-neutral-400">
                <ReactMarkdown>{result.notes}</ReactMarkdown>
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="flex-1 overflow-y-auto p-4 m-0 data-[state=inactive]:hidden w-full">
               <div className="text-xs leading-relaxed text-neutral-400 font-mono whitespace-pre-wrap break-words">
                {result.transcript}
               </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}