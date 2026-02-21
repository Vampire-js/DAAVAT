"use client";

import React, { useState } from "react";
import { Youtube, FileText, X, Loader2, Sparkles, Plus, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNote } from "@/app/contexts/NotesContext"; 
import { useUI } from "@/app/contexts/AlertContext";   
import { ML_API_BASE } from "@/app/lib/api";

// Define the available model sizes
type ModelSize = "small" | "medium" | "large";

interface StagedItem {
  id: string;
  type: "video" | "document" | "audio";
  name: string;
  value: string | File;
}

export default function UnifiedAddTool() {
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelSize, setModelSize] = useState<ModelSize>("medium"); 
  const [noteTitle, setNoteTitle] = useState("");
  // Inside UnifiedAddTool component
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // Pull 'folders' from your existing context (Assuming folders are stored in your state)
  const { addNote, folders } = useNote(); // Ensure 'folders' is exported from your context
  const { showAlert } = useUI();

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
    setIsProcessing(true);

    try {
      const formData = new FormData();
      
      const links = stagedItems
        .filter((item) => item.type === "video")
        .map((item) => item.value as string);
      
      formData.append("links", JSON.stringify(links));
      formData.append("model_size", modelSize); 

      // Send both documents and audio files
      stagedItems
        .filter((item) => item.type === "document" || item.type === "audio")
        .forEach((item) => {
          formData.append("files", item.value as File);
        });

      // 1. Fetch synthesis from ML Backend
      const response = await fetch(`${ML_API_BASE}/generate_master_note`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Synthesis failed");
      const data = await response.json();
      
      console.log("ML Backend Data Received:", data);

      // Determine if we need a "Master" layout or a "Single Source" layout
      const isSingleSource = stagedItems.length === 1;
      
      // If only one file, use its specific summary; otherwise use the meta_summary
      const finalContent = isSingleSource 
        ? (data.sources?.[0]?.summary || data.meta_summary) 
        : data.meta_summary;

      const finalTitle = noteTitle.trim() 
        ? noteTitle.trim() 
        : isSingleSource 
          ? stagedItems[0].name 
          : `Master Note: ${new Date().toLocaleDateString()}`;

      // 2. 🔥 THE FIX: Combine Summary and Transcript into the 'content' field
      const processedReferences = (data.sources || []).map((source: any) => {
        const isVideo = source.type === "video" || source.type === "YouTube";
        const isAudio = source.type === "audio" || source.source === "Audio";
        
        // Match the enum in your MongoDB Schema: ["YouTube", "PDF", "Audio"]
        const dbSource = isVideo ? "YouTube" : isAudio ? "Audio" : "PDF";
        
        // Build a combined Markdown string for the DB
        let combinedContent = `**Summary:**\n${source.summary || "No summary available."}\n\n`;
        
        // Add the transcript if it exists and is not a PDF
        if ((isVideo || isAudio) && source.full_text) {
             combinedContent += `**Transcript:**\n${source.full_text}`;
        }

        return {
          source: dbSource,
          title: source.title || "Source Reference",
          content: combinedContent
        };
      });

      // 3. 🔥 Send EVERYTHING in ONE call to avoid state race conditions
      await addNote({
        title: finalTitle,
        content: finalContent,
        parentId: selectedFolderId, // 🔥 This links the note to the selected folder
        tags: isSingleSource ? ["single-source"] : ["synthesis", "multi-source"],
        references: processedReferences 
      });

      showAlert(isSingleSource ? "Source processed!" : "Master Study Note generated with sources!", "success");
      setStagedItems([]);
      setNoteTitle("");
    } catch (error) {
      console.error("Synthesis Error:", error);
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

        {/* UPDATED ACCEPT ATTRIBUTE */}
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

      {/* Generate Button */}
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
    </div>
  );
}