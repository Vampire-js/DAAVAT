"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Youtube, 
  Loader2, 
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  Cookie, 
  FileText, 
  AlignLeft 
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
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [modelSize, setModelSize] = useState<ModelSize>("medium");
  
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
      if (err.message.includes("restricted") || err.message.includes("download") || err.message.includes("cookies")) {
        setErrorMsg("Failed to download. If this is age-restricted, please upload your 'cookies.txt' file below.");
      } else {
        setErrorMsg(err.message || "Failed to process video.");
      }
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="space-y-5 text-sm text-neutral-300">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-white flex items-center gap-2">
          <Youtube className="text-red-500" /> YouTube Summarizer
        </h2>
        
        {/* Cookie Upload Button */}
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
            className="border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700"
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

      <p className="text-neutral-400">
        Paste a YouTube link to get structured lecture notes and the transcript.
      </p>

      {/* Model Slider */}
      <div className="flex flex-col gap-2 p-3 border border-neutral-800 rounded-md bg-neutral-900/50">
        <label className="text-xs font-medium text-neutral-400">Model Size: <span className="text-red-400 font-bold uppercase">{modelSize}</span></label>
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
            className="w-full accent-red-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-neutral-500 uppercase font-bold tracking-wider">
            <span>Small (Fast)</span>
            <span>Medium (Balanced)</span>
            <span>Large (Accurate)</span>
        </div>
      </div>

      {/* Input Section */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="https://www.youtube.com/watch?v=..."
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-red-500 transition-colors"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button 
          onClick={handleSummarize} 
          disabled={!url || loading}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {loading ? <Loader2 className="animate-spin" /> : "Summarize"}
        </Button>
      </div>

      {/* Error Display */}
      {errorMsg && (
        <div className="bg-red-950/30 border border-red-900/50 p-3 rounded-md flex items-start gap-3 text-red-200">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="font-medium">Download Failed</p>
            <p className="text-xs opacity-90">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Result Section */}
      {result && (
        <div className="border border-neutral-800 bg-neutral-900/50 rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2">
          <Tabs defaultValue="notes" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-neutral-950 border border-neutral-800">
              <TabsTrigger value="notes" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white">
                <FileText className="w-4 h-4 mr-2" /> Lecture Notes
              </TabsTrigger>
              <TabsTrigger value="transcript" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white">
                <AlignLeft className="w-4 h-4 mr-2" /> Transcript
              </TabsTrigger>
            </TabsList>
            
            {/* Tab 1: Lecture Notes */}
            <TabsContent value="notes" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.notes)}>
                  <Copy size={14} className="mr-1"/> Copy Markdown
                </Button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none bg-neutral-950/50 p-6 rounded-md border border-neutral-800">
                <ReactMarkdown>{result.notes}</ReactMarkdown>
              </div>
            </TabsContent>

            {/* Tab 3: Transcript */}
            <TabsContent value="transcript" className="mt-4 space-y-2">
               <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.transcript)}>
                  <Copy size={14} className="mr-1"/> Copy Text
                </Button>
              </div>
               <div className="bg-neutral-950 p-4 rounded-md border border-neutral-800 h-96 overflow-y-auto text-xs leading-relaxed text-neutral-400 font-mono whitespace-pre-wrap">
                {result.transcript}
               </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}