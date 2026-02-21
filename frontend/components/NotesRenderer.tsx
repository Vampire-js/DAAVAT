"use client";

import { useNote } from "@/app/contexts/NotesContext";
import { Tldraw } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";

import {
  X,
  BrainCircuit,
  Layers,
  Loader2,
  Image as ImageIcon,
  ChevronDown,
  Sparkles,
  Lock,
  Zap,
  Youtube,
  Mic,
  FileText,
  File,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import FlashcardGenerator from "./FlashcardGenerator";
import QuizGenerator from "./QuizGenerator";
import Editor from "./Editor";
import { Graph } from "./Graph";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/app/lib/api";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useUI } from "@/app/contexts/AlertContext";

interface SidebarProps {
  selected: "notes" | "graph";
  setSelected: (value: "notes" | "graph") => void;
}

type Tab = {
  id: string | null;
  name: string;
  saved: boolean;
};

export default function NotesRenderer({ selected, setSelected }: SidebarProps) {
  const {
    docs,
    selectedDocId,
    setSelectedDocId,
    content,
    setContent,
    references,
    setReferences,
  } = useNote();

  const { showDialog } = useUI();

  // Verify the selectedDocId actually exists in the current account's docs array
  const activeDoc = useMemo(() => 
    docs.find((d) => d._id === selectedDocId),
    [docs, selectedDocId]
  );

  const editorRef = useRef<any>(null);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [mindMapUrl, setMindMapUrl] = useState<string | null>(null);
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);

  // ==========================
  // HOOKS (Must be at top level)
  // ==========================

  useEffect(() => {
    if (!selectedDocId || !activeDoc) return;

    setTabs((prev) => {
      if (prev.some((t) => t.id === selectedDocId)) return prev;
      return [
        ...prev,
        { id: selectedDocId, name: activeDoc.name, saved: true },
      ];
    });

    setMindMapUrl(null);
  }, [selectedDocId, activeDoc]);

  const saveChanges = useCallback(() => {
    if (!selectedDocId || !activeDoc) return;

    if (activeDoc.type === "note") {
      apiFetch("/fileTree/updateNote", {
        method: "POST",
        body: JSON.stringify({
          noteID: selectedDocId,
          content,
          references,
        }),
      }).then(() => {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === selectedDocId ? { ...t, saved: true } : t
          )
        );
      });
    }

    if (activeDoc.type === "board" && editorRef.current) {
      const snapshot = editorRef.current.getSnapshot();

      apiFetch("/fileTree/updateBoard", {
        method: "POST",
        body: JSON.stringify({
          boardID: selectedDocId,
          content: JSON.stringify(snapshot),
        }),
      }).then(() => {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === selectedDocId ? { ...t, saved: true } : t
          )
        );
      });
    }
  }, [selectedDocId, activeDoc, content, references]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveChanges();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveChanges]);

  const switchTab = async (tab: Tab) => {
    if (!tab.id) return;

    const prevTab = tabs.find((t) => t.id === selectedDocId);

    const performSwitch = async () => {
      setSelectedDocId(tab.id);

      const doc = docs.find((d) => d._id === tab.id);
      if (!doc) return;

      try {
        if (doc.type === "note") {
          const res = await apiFetch("/fileTree/getNoteById", {
            method: "POST",
            body: JSON.stringify({ noteID: tab.id }),
          });
          const data = await res.json();
          const note = Array.isArray(data) ? data[0] : data;

          setContent(note?.content ?? "");
          setReferences(note?.references ?? []);
        }

        if (doc.type === "board") {
          const res = await apiFetch("/fileTree/getBoardById", {
            method: "POST",
            body: JSON.stringify({ boardID: tab.id }),
          });
          const data = await res.json();
          const board = Array.isArray(data) ? data[0] : data;

          setContent(board?.content ?? "");
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (prevTab && !prevTab.saved) {
      showDialog({
        message: "You have unsaved changes",
        onConfirm: performSwitch,
      });
    } else {
      performSwitch();
    }
  };

  const closeTab = (id: string | null) => {
    const tab = tabs.find((t) => t.id === id);

    const performClose = () => {
      setTabs((prev) => prev.filter((t) => t.id !== id));

      if (selectedDocId === id) {
        const updated = tabs.filter((t) => t.id !== id);
        const next = updated.at(-1);
        setSelectedDocId(next?.id ?? null);
      }
    };

    if (tab && !tab.saved) {
      showDialog({
        message: "You have unsaved changes",
        onConfirm: performClose,
      });
    } else {
      performClose();
    }
  };

  const generateMindMap = async () => {
    if (!content) return;
    setIsGeneratingMap(true);
    setMindMapUrl(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ML_API_URL}/generate_mindmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_content: content }),
      });

      const data = await res.json();
      if (data.image_url) setMindMapUrl(data.image_url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMap(false);
    }
  };

  // ==========================
  // CONDITIONAL RETURNS (Safe here)
  // ==========================

  if (selected === "graph") {
    return <Graph setSelected={setSelected} />;
  }

  // If the ID doesn't match a document in the CURRENT account, 
  // treat it as no document selected.
  if (!selectedDocId || !activeDoc) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a document
      </div>
    );
  }

  // ==========================
  // MAIN UI
  // ==========================
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* TABS */}
      <div className="flex border-b border-border bg-card overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id ?? "null"}
            className={`flex items-center px-4 py-2 gap-2 cursor-pointer ${
              selectedDocId === tab.id
                ? "bg-background text-foreground border-t-2 border-t-primary"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
            onClick={() => switchTab(tab)}
          >
            <span className="truncate max-w-[120px]">
              {!tab.saved ? "*" : ""} {tab.name}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* NOTE VIEW */}
      {activeDoc.type === "note" && (
        <>
          {/* TOOLBAR */}
          <div className="p-3 border-b border-border flex justify-end gap-2 bg-card">

            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Layers className="mr-2 h-3 w-3" />
                  Flashcards
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Flashcard Generator</DialogTitle>
                </DialogHeader>
                <FlashcardGenerator isPopup />
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <BrainCircuit className="mr-2 h-3 w-3" />
                  Quiz Me
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Quiz Generator</DialogTitle>
                </DialogHeader>
                <QuizGenerator isPopup />
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <div className="flex">
                <Button
                  onClick={generateMindMap}
                  disabled={!content || isGeneratingMap}
                  size="sm"
                  variant="outline"
                  className="rounded-r-none border-r-0"
                >
                  {isGeneratingMap ? (
                    <Loader2 className="animate-spin h-3 w-3 mr-2" />
                  ) : (
                    <ImageIcon className="h-3 w-3 mr-2" />
                  )}
                  Mind Map
                </Button>

                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-l-none px-2">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </div>

              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Zap className="mr-2 h-4 w-4" />
                  Pro Features
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {mindMapUrl && (
            <div className="p-4 border-b border-border bg-card">
              <img src={mindMapUrl} className="max-h-64 mx-auto" />
            </div>
          )}

          {/* REFERENCES */}
          {references?.length > 0 && (
            <div className="flex gap-4 p-4 border-b border-border">
              {references.map((r, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  {r.title}
                </div>
              ))}
            </div>
          )}

          {/* EDITOR */}
          <div className="flex-1">
            <Editor
              setChanged={() =>
                setTabs((prev) =>
                  prev.map((t) =>
                    t.id === selectedDocId ? { ...t, saved: false } : t
                  )
                )
              }
            />
          </div>
        </>
      )}

      {/* BOARD VIEW */}
      {activeDoc.type === "board" && (
        <div className="flex-1 bg-background">
          <Tldraw
            key={selectedDocId}
            inferDarkMode
            onMount={(editor) => {
              editorRef.current = editor;

              if (activeDoc.content) {
                try {
                  const snapshot = JSON.parse(activeDoc.content);
                  editor.loadSnapshot(snapshot);
                } catch (err) {
                  console.error(err);
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
}