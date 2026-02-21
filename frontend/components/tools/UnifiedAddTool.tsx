"use client";

import React, { useState } from "react";
// Added Lock icon for Pro options
import { Youtube, FileText, X, Loader2, Sparkles, Plus, Mic, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNote } from "@/app/contexts/NotesContext"; 
import { useUI } from "@/app/contexts/AlertContext";   
import { ML_API_BASE } from "@/app/lib/api";
// Import Tooltip components
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Define the available model sizes
type ModelSize = "small" | "medium" | "large";

interface StagedItem {
  id: string;
  type: "video" | "document" | "audio";
  name: string;
  value: string | File;
}

// 1. Added Interface for props to support parent callbacks
interface UnifiedAddToolProps {
  onClose?: () => void;
  setProgress?: (progress: number | null) => void;
}

export default function UnifiedAddTool({ onClose, setProgress }: UnifiedAddToolProps) {
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelSize, setModelSize] = useState<ModelSize>("medium"); 
  const [noteTitle, setNoteTitle] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // Destructure updateNote from context to allow background updates
  const { addNote, folders, updateNote } = useNote(); 
  const { showAlert } = useUI();

  // Added function to handle Pro Alert
  const showProAlert = () => {
    showAlert("Multi-language support is a Premium Feature. Please upgrade your plan to continue.", "info");
  };

  const addLink = () => {
    if (!urlInput.trim()) return;
    
    const isYoutube = urlInput.includes("youtube.com") || urlInput.includes("youtu.be");
    if (!isYoutube) {
      showAlert("Only YouTube links are supported.", "error");
      return;
    }

    const newItem: StagedItem = {
      id: Math.random().toString(36).substring(2, 9),
      type: "video",
      name: "YouTube Video",
      value: urlInput.trim(),
    };

    setStagedItems((prev) => [...prev, newItem]);
    setUrlInput("");
  };

  const addFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newItems: StagedItem[] = files.map((file) => {
        const isAudio = file.type.startsWith("audio/");
        return {
          id: Math.random().toString(36).substring(2, 9),
          type: isAudio ? "audio" : "document",
          name: file.name,
          value: file,
        };
      });
      setStagedItems((prev) => [...prev, ...newItems]);
    }
  };

  const removeItem = (id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleGenerateMasterNote = async () => {
    if (stagedItems.length === 0) return;

    const isSingleSource = stagedItems.length === 1;
    const finalTitle = noteTitle.trim() 
      ? noteTitle.trim() 
      : isSingleSource 
        ? stagedItems[0].name 
        : `Master Note: ${new Date().toLocaleDateString()}`;

    // 1. Create placeholder and close modal
    let tempNote;
    try {
      tempNote = await addNote({
        title: finalTitle,
        content: "### 🪄 Processing Sources...\nYour summary and references will appear here shortly.",
        parentId: selectedFolderId,
        tags: ["processing"],
        references: []
      });

      // CRITICAL CHECK: Ensure addNote actually returned an object with an _id
      if (!tempNote || !tempNote._id) {
        throw new Error("Failed to create initial placeholder note.");
      }
    } catch (err) {
      console.error("Initial note creation failed:", err);
      showAlert("Could not initialize note. Please try again.", "error");
      return; // Stop execution if we don't have a note to update
    }

    if (onClose) onClose();
    setIsProcessing(true);

    try {
      const formData = new FormData();
      
      const links = stagedItems
        .filter((item) => item.type === "video")
        .map((item) => item.value as string);
      
      formData.append("links", JSON.stringify(links));
      formData.append("model_size", modelSize); 

      stagedItems
        .filter((item) => item.type === "document" || item.type === "audio")
        .forEach((item) => {
          formData.append("files", item.value as File);
        });

      const response = await fetch(`${ML_API_BASE}/generate_master_note`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Synthesis failed");

      // --- REAL-TIME STREAM READER ---
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          
          // Check if the chunk contains a progress update from backend
          try {
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (!line.trim()) continue;
              const parsed = JSON.parse(line);
              
              if (parsed.progress && setProgress) {
                setProgress(parsed.progress); // Real progress from console/backend!
              }
              if (parsed.final_result) {
                finalData = JSON.stringify(parsed.final_result);
              }
            }
          } catch (e) {
            // If chunk isn't JSON, it might be the final raw data
            finalData += chunk;
          }
        }
      }

      // 2. Update note with final data
      const data = JSON.parse(finalData);
      console.log("ML Backend Data Received:", data);

      const finalContent = isSingleSource 
        ? (data.sources?.[0]?.summary || data.meta_summary) 
        : data.meta_summary;

      const processedReferences = (data.sources || []).map((source: any) => {
        const isVideo = source.type === "video" || source.type === "YouTube";
        const isAudio = source.type === "audio" || source.source === "Audio";
        const dbSource = isVideo ? "YouTube" : isAudio ? "Audio" : "PDF";
        
        let combinedContent = `**Summary:**\n${source.summary || "No summary available."}\n\n`;
        
        if ((isVideo || isAudio) && source.full_text) {
             combinedContent += `**Transcript:**\n${source.full_text}`;
        }

        return {
          source: dbSource,
          title: source.title || "Source Reference",
          content: combinedContent
        };
      });

      // 6. UPDATE THE EXISTING NOTE WITH FINAL DATA
      await updateNote(tempNote._id, {
        content: finalContent,
        tags: isSingleSource ? ["single-source"] : ["synthesis", "multi-source"],
        references: processedReferences 
      });

      // 7. Hit the finish line
      if (setProgress) setProgress(100);
      showAlert(isSingleSource ? "Source processed!" : "Master Study Note generated with sources!", "success");
      
      // 8. Cleanup: Wait for the 100% animation to finish before hiding
      setTimeout(() => { if (setProgress) setProgress(null); }, 1200);

      setStagedItems([]);
      setNoteTitle("");
    } catch (error) {
      console.error("Synthesis Error:", error);
      if (setProgress) setProgress(null);
      showAlert("Failed to synthesize sources.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-2 text-white bg-neutral-950 rounded-lg border border-neutral-800">
      <div className="space-y-3">

        {/* Folder Selection Dropdown */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">
            Target Folder
          </label>
          <select
            value={selectedFolderId || ""}
            onChange={(e) => setSelectedFolderId(e.target.value || null)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md h-9 text-sm text-white px-2 focus:ring-1 focus:ring-orange-500 outline-none"
          >
            <option value="">Root Directory (No Folder)</option>
            {folders?.map((folder) => (
              <option key={folder._id} value={folder._id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">
            Note Title
          </label>
          <Input
            placeholder="Enter note title (e.g. Biology Lecture 1)..."
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className="bg-neutral-900 border-neutral-800 focus:ring-orange-500 h-9 text-sm"
          />
        </div>
        
        {/* Synthesis Accuracy Slider */}
        <div className="flex flex-col gap-2 p-3 border border-neutral-800 rounded-md bg-neutral-900/50">
          <label className="text-xs font-medium text-neutral-400 flex justify-between">
            <span>Synthesis Accuracy</span>
            <span className={`font-bold uppercase ${
              modelSize === "small" ? "text-green-400" : modelSize === "medium" ? "text-yellow-400" : "text-orange-400"
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
              className="w-full accent-orange-500 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-neutral-500 uppercase font-bold tracking-wider">
              <span>Fast</span>
              <span>Balanced</span>
              <span>Detailed</span>
          </div>
        </div>

        {/* Input Fields */}
        <div className="flex gap-2">
          <Input
            placeholder="Paste YouTube Link..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="bg-neutral-900 border-neutral-800 focus:ring-orange-500"
            onKeyDown={(e) => e.key === "Enter" && addLink()}
          />
          <Button onClick={addLink} variant="secondary">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative border-2 border-dashed border-neutral-800 rounded-xl p-6 hover:border-orange-500/50 transition-colors text-center group">
          <input
            type="file"
            multiple
            accept=".pdf,audio/*"
            onChange={addFile}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="flex justify-center gap-2 text-neutral-500 group-hover:text-orange-500 mb-2">
            <FileText className="w-8 h-8" />
            <Mic className="w-8 h-8" />
          </div>
          <p className="text-sm text-neutral-400">Drag & Drop PDFs or Audio</p>
        </div>
      </div>

      {/* Staged Items List */}
      <div className="flex-1 overflow-y-auto min-h-[150px] bg-neutral-900/50 rounded-xl border border-neutral-900 p-3">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Staged Resources ({stagedItems.length})
        </h3>
        
        {stagedItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 opacity-30">
            <Sparkles className="w-5 h-5 mb-1" />
            <p className="text-xs">Pending items appear here</p>
          </div>
        )}

        <div className="space-y-2">
          {stagedItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between bg-neutral-900 p-2 rounded-lg border border-neutral-800">
              <div className="flex items-center gap-3 overflow-hidden">
                {item.type === "video" ? (
                  <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                ) : item.type === "audio" ? (
                  <Mic className="w-4 h-4 text-purple-500 shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                )}
                <span className="text-xs truncate">{item.name}</span>
              </div>
              <X className="w-4 h-4 text-neutral-500 cursor-pointer hover:text-white" onClick={() => removeItem(item.id)} />
            </div>
          ))}
        </div>
      </div>

      {/* Generate Button Container */}
      <div className="space-y-3">
        <Button
          disabled={isProcessing || stagedItems.length === 0}
          onClick={handleGenerateMasterNote}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-12"
        >
          {isProcessing ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Synthesizing...</>
          ) : (
            <><Sparkles className="w-5 h-5 mr-2" /> Generate Master Note</>
          )}
        </Button>

        {/* PRO OPTIONS - Display message on hover using Tooltip */}
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-400 text-[11px] font-bold uppercase tracking-wider h-8 flex items-center justify-center gap-2 cursor-default"
              >
                <Lock className="w-3 h-3" />
                Pro Options: Multi-Language Support
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-neutral-900 border-neutral-800 text-indigo-400">
              <p>Multi-language support is a Premium Feature. Please upgrade your plan to continue.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}