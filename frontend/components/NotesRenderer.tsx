"use client";

import { useNote } from "@/app/contexts/NotesContext";
import { X, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { apiFetch } from "@/app/lib/api";
import { useEffect, useState, useCallback } from "react";
import { useUI } from "@/app/contexts/AlertContext";
import Editor from "./Editor";
import { useRouter } from "next/router";
import { useAuth } from "@/app/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type Tab = {
  id: string | null;
  name: string | null;
  saved: boolean;
};

export default function NotesRenderer() {
  const { selectedNoteId, setSelectedNoteId, content, setContent, name } =
    useNote();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const { showDialog } = useUI();
  const { logout } = useAuth();
  
  // Mind Map State
  const [mindMapUrl, setMindMapUrl] = useState<string | null>(null);
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);

  useEffect(() => {
    if (!selectedNoteId) return;
    setTabs((prev) => {
      const exists = prev.some((tab) => tab.id === selectedNoteId);
      if (exists) return prev;
      return [...prev, { id: selectedNoteId, name, saved: true }];
    });
    // Reset mind map when switching notes
    setMindMapUrl(null);
  }, [selectedNoteId]);

  const closeTab = (id: string | null) => {
    const tab = tabs.find(t => t.id === id);

    const performClose = () => {
      setTabs(prev => prev.filter(t => t.id !== id));

      if (selectedNoteId === id) {
        const updated = tabs.filter(t => t.id !== id);
        const next = updated.at(-1);

        setSelectedNoteId(next?.id ?? null);

        if (next?.id) {
          apiFetch("/fileTree/getNoteById", {
            method: "POST",
            body: JSON.stringify({ noteID: next.id }),
          })
            .then(res => {
              if(res.status == 401){
                showDialog({title:"Session expired" , message:"Please log in to continue using", onConfirm() {
                    logout()
                },})
              }
              return res.json();
            })
            .then(data => setContent(data[0]?.content ?? ""));
        } else {
          setContent("");
        }
      }
    };

    if(tab && !tab.saved) {
        showDialog({
            message: "The changes are not saved", 
            onConfirm: () => { performClose() }
        });
    } else {
        performClose();
    }
  };

  const saveChanges = useCallback(() => {
    if (!selectedNoteId) return;

    apiFetch("/fileTree/updateNote", {
      method: "POST",
      body: JSON.stringify({
        noteID: selectedNoteId,
        content: content,
      }),
    }).then(() => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === selectedNoteId ? { ...t, saved: true } : t
        )
      );
    });
  }, [selectedNoteId, content]);

  useEffect(() => {
    const handler = () => saveChanges();
    window.addEventListener("save_note", handler);
    return () => window.removeEventListener("save_note", handler);
  }, [saveChanges]);

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveChanges();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [saveChanges]);

  const generateMindMap = async () => {
    if (!content) return;
    setIsGeneratingMap(true);
    setMindMapUrl(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/generate_mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_content: content }),
      });
      const data = await res.json();
      if (data.image_url) {
        setMindMapUrl(data.image_url);
      }
    } catch (err) {
      console.error("Mind Map Error:", err);
    } finally {
      setIsGeneratingMap(false);
    }
  };

  return selectedNoteId ? (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs (Note Name) */}
      <div className="flex border-neutral-800 overflow-x-auto shrink-0 bg-neutral-950">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center px-3 border-t-1 border-x-1 border-t-neutral-800 border-x-neutral-800 border-b-transparent py-2 gap-2 cursor-pointer transition-all ${
              selectedNoteId === tab.id
                ? "bg-neutral-950 text-white"
                : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
            }`}
            onClick={() => {
              if (selectedNoteId === tab.id) return;

              // --- ADDED SAFETY CHECK FOR SWITCHING TABS ---
              const prevTab = tabs.find(e => e.id == selectedNoteId);
              
              const switchTab = () => {
                // If user confirms discard, we mark it as saved locally to stop warning loop
                if(prevTab){
                  prevTab.saved = true;
                }
                
                setSelectedNoteId(tab.id);
                apiFetch("/fileTree/getNoteById", {
                  method: "POST",
                  body: JSON.stringify({ noteID: tab.id }),
                })
                  .then((e) => e.json())
                  .then((data) => setContent(data[0]?.content ?? ""));
              };

              if (prevTab && !prevTab.saved) {
                showDialog({
                  message: "The changes are not saved",
                  onConfirm: () => { switchTab(); }
                });
              } else {
                switchTab();
              }
              // ---------------------------------------------
            }}
          >
            <span className="truncate max-w-[120px]">
              {!tab.saved ? "*" : ""} {tab.name}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="hover:text-red-400 transition"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Mind Map Generator Section */}
      <div className="shrink-0 p-3 border-b border-neutral-800 bg-neutral-950 flex flex-col items-start gap-4">
        {!mindMapUrl ? (
          <div className="w-full flex justify-end px-4">
             <Button 
              onClick={generateMindMap} 
              disabled={isGeneratingMap || !content}
              size="sm"
              variant="outline"
              className="bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800"
             >
                {isGeneratingMap ? <Loader2 className="animate-spin mr-2 h-3 w-3"/> : <Sparkles className="mr-2 h-3 w-3 text-yellow-500"/>}
                Generate Mind Map
             </Button>
          </div>
        ) : (
          <div className="w-full bg-neutral-900/50 border-b border-neutral-800 p-4 relative animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-3">
               <h3 className="text-xs font-semibold text-neutral-400 flex items-center gap-2 uppercase tracking-wider">
                 <ImageIcon className="h-3 w-3 text-blue-400"/> Generated Visuals
               </h3>
               <div className="flex gap-2">
                 <a 
                    href={mindMapUrl} 
                    download="mindmap.png"
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition-colors"
                 >
                    Download PNG
                 </a>
                 <button 
                   onClick={() => setMindMapUrl(null)}
                   className="text-neutral-500 hover:text-white"
                 >
                   <X size={16}/>
                 </button>
               </div>
            </div>
            <div className="bg-white rounded-md p-2 flex justify-center overflow-x-auto">
              <img src={mindMapUrl} alt="Mind Map" className="max-h-64 object-contain" />
            </div>
          </div>
        )}
      </div>

      {/* Editor - Fills remaining space */}
      <div className="flex-1 overflow-hidden relative" spellCheck={false} contentEditable={false}>
        <Editor
          setChanged={() => {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === selectedNoteId ? { ...t, saved: false } : t
              )
            );
          }}
        />
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center h-full text-neutral-500">
      Select a note to start editing
    </div>
  );
}