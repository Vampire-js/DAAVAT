"use client";

import { useNote } from "@/app/contexts/NotesContext";
import { Tldraw } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";

import { X, BrainCircuit, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import QuizGenerator from "./QuizGenerator";
import FlashcardGenerator from "./FlashcardGenerator";
import { apiFetch } from "@/app/lib/api";
import { useEffect, useState, useCallback, useRef } from "react";
import Editor from "./Editor";
import { Button } from "@/components/ui/button";
import { Graph } from "./Graph";

interface SidebarProps {
  selected: "notes" | "graph";
  setSelected: (value: "notes" | "graph") => void;
}

export default function NotesRenderer({ selected, setSelected }: SidebarProps) {
  const {
    docs,
    selectedDocId,
    setSelectedDocId,
    content,
    references
  } = useNote();

  const activeDoc = docs.find(d => d._id === selectedDocId);

  const [tabs, setTabs] = useState<
    { id: string | null; name: string; saved: boolean }[]
  >([]);

  const editorRef = useRef<any>(null);

  // ==========================
  // TAB MANAGEMENT
  // ==========================
  useEffect(() => {
    if (!selectedDocId || !activeDoc) return;

    setTabs(prev => {
      if (prev.some(tab => tab.id === selectedDocId)) return prev;
      return [...prev, { id: selectedDocId, name: activeDoc.name, saved: true }];
    });
  }, [selectedDocId, activeDoc]);

  // ==========================
  // SAVE LOGIC (NOTE + BOARD)
  // ==========================
  const saveChanges = useCallback(() => {
    if (!selectedDocId || !activeDoc) return;

    // 📝 NOTE SAVE
    if (activeDoc.type === "note") {
      apiFetch("/fileTree/updateNote", {
        method: "POST",
        body: JSON.stringify({
          noteID: selectedDocId,
          content,
          references,
        }),
      }).then(() => {
        setTabs(prev =>
          prev.map(t =>
            t.id === selectedDocId ? { ...t, saved: true } : t
          )
        );
      });
    }

    // 🎨 BOARD SAVE
    if (activeDoc.type === "board" && editorRef.current) {
      const snapshot = editorRef.current.getSnapshot();

      apiFetch("/fileTree/updateBoard", {
        method: "POST",
        body: JSON.stringify({
          boardID: selectedDocId,
          content: JSON.stringify(snapshot),
        }),
      }).then(() => {
        setTabs(prev =>
          prev.map(t =>
            t.id === selectedDocId ? { ...t, saved: true } : t
          )
        );
      });
    }
  }, [selectedDocId, content, references, activeDoc]);

  // Ctrl + S
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

  // ==========================
  // GRAPH VIEW
  // ==========================
  if (selected === "graph") {
    return <Graph setSelected={setSelected} />;
  }

  // ==========================
  // EMPTY STATE
  // ==========================
  if (!selectedDocId || !activeDoc) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        Select a document
      </div>
    );
  }

  // ==========================
  // CLOSE TAB HANDLER
  // ==========================
  const closeTab = (tabId: string | null) => {
    setTabs(prev => {
      const updated = prev.filter(t => t.id !== tabId);

      if (selectedDocId === tabId) {
        const nextTab = updated[updated.length - 1];

        if (nextTab) {
          setSelectedDocId(nextTab.id);
        } else {
          setSelectedDocId(null);
        }
      }

      return updated;
    });
  };

  // ==========================
  // MAIN LAYOUT
  // ==========================
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ================= Tabs ================= */}
      <div className="flex border-neutral-800 overflow-x-auto shrink-0 bg-neutral-950">
        {tabs.map(tab => (
          <div
            key={tab.id ?? "null"}
            className={`flex items-center px-3 border-t border-x border-neutral-800 py-2 gap-2 cursor-pointer ${
              selectedDocId === tab.id
                ? "bg-neutral-950 text-white"
                : "bg-neutral-900 text-neutral-400"
            }`}
            onClick={() => setSelectedDocId(tab.id)}
          >
            <span className="truncate max-w-[120px]">
              {!tab.saved ? "*" : ""} {tab.name}
            </span>

            <button
              onClick={e => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* ================= NOTE VIEW ================= */}
      {activeDoc.type === "note" && (
        <>
          {/* AI Tools */}
          <div className="p-3 border-b border-neutral-800 bg-neutral-950 flex justify-end gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Layers className="mr-2 h-3 w-3" />
                  Flashcards
                </Button>
              </DialogTrigger>
              <DialogContent>
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
                <QuizGenerator isPopup />
              </DialogContent>
            </Dialog>
          </div>

          {/* Editor */}
          <div className="flex-1 relative">
            <Editor
              setChanged={() => {
                setTabs(prev =>
                  prev.map(t =>
                    t.id === selectedDocId ? { ...t, saved: false } : t
                  )
                );
              }}
            />
          </div>
        </>
      )}

      {/* ================= BOARD VIEW ================= */}
      {activeDoc.type === "board" && (
        <div className="flex-1 bg-neutral-950">
          <Tldraw
            inferDarkMode
            onMount={(editor) => {
              editorRef.current = editor;

              if (activeDoc.content) {
                try {
                  const snapshot = JSON.parse(activeDoc.content);
                  editor.loadSnapshot(snapshot);
                } catch (err) {
                  console.error("Failed to load board snapshot", err);
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
}