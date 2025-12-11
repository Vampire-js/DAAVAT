"use client";

import { useNote } from "@/app/contexts/NotesContext";
import { X } from "lucide-react";
import { apiFetch } from "@/app/lib/api";
import { useEffect, useState } from "react";
import { useUI } from "@/app/contexts/AlertContext";
import Editor from "./editor"; // ✅ matches folder

type Tab = { id: string; name: string | null; cachedContent?: string | null };

export default function NotesRenderer() {
  const { selectedNoteId, setSelectedNoteId, content, setContent, name } = useNote();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [changed, setChanged] = useState(false);
  const { showAlert, showDialog } = useUI();

  // Add selected note to tabs
  useEffect(() => {
    if (!selectedNoteId) return;
    setTabs((prev) => {
      if (prev.some((tab) => tab.id === selectedNoteId)) return prev;
      // try to hydrate cached content from sessionStorage if present
      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem(`note_cache_${selectedNoteId}`);
      } catch (e) {
        stored = null;
      }
      const newTab: Tab = { id: selectedNoteId, name, ...(stored ? { cachedContent: stored } : content !== null ? { cachedContent: content } : {}) };
      return [...prev, newTab];
    });
  }, [selectedNoteId, name]);

  // Keep the tabs' cachedContent in sync with the global `content` for the selected note
  useEffect(() => {
    if (!selectedNoteId) return;
    // don't overwrite cachedContent with null when global `content` resets (e.g., on login)
    if (content === null) return;
    setTabs((prev) => {
      const updated = prev.map((tab) => (tab.id === selectedNoteId ? { ...tab, cachedContent: content } : tab));
      // save to sessionStorage
      try {
        const t = updated.find((t) => t.id === selectedNoteId);
        if (t && t.cachedContent !== undefined && t.cachedContent !== null) {
          sessionStorage.setItem(`note_cache_${selectedNoteId}`, t.cachedContent);
        }
      } catch (e) {
        // ignore storage errors
      }
      return updated;
    });
  }, [content, selectedNoteId]);

  const closeTab = (id: string | null, force = false) => {
    if (!force && changed) {
      showDialog({
        title: "Do you want to revert all changes?",
        message: "Closing the tab without saving will revert the changes",
        confirmText: "Yes, revert",
        onConfirm: () => closeTab(id, true),
      });
      return;
    }

    const updated = tabs.filter((tab) => tab.id !== id);
    setTabs(updated);

    if (selectedNoteId === id) {
      const next = updated.at(-1);
      setSelectedNoteId(next?.id ?? null);
      if (next?.id) {
        apiFetch("/fileTree/getNoteById", { method: "POST", body: JSON.stringify({ noteID: next.id }) })
          .then((res) => res.json())
          .then((data) => setContent(data[0]?.content ?? ""));
      } else setContent("");
    }
  };

  const saveChanges = () => {
    if (!selectedNoteId) return;
    apiFetch("/fileTree/updateNote", {
      method: "POST",
      body: JSON.stringify({ noteID: selectedNoteId, content }),
    }).then(() => setChanged(false));
  };

  // Save shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveChanges();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [content, selectedNoteId]);

  return selectedNoteId ? (
    <div className="h-full overflow-y-scroll">
      {/* Tabs */}
      <div className="flex border-neutral-800 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center px-3 border-t-1 border-x-1 border-t-neutral-800 border-x-neutral-800 border-b-transparent py-2 gap-2 cursor-pointer transition-all ${
              selectedNoteId === tab.id ? "bg-neutral-950 text-white" : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
            }`}
              onClick={() => {
              if (selectedNoteId === tab.id) return;
              setSelectedNoteId(tab.id);
              // If we have cached content for this tab (unsaved or previously loaded), use it.
              if (tab.cachedContent !== undefined) {
                setContent(tab.cachedContent ?? "");
                return;
              }

              if (tab.id) {
                apiFetch("/fileTree/getNoteById", { method: "POST", body: JSON.stringify({ noteID: tab.id }) })
                  .then((res) => res.json())
                  .then((data) => {
                    const fetched = data[0]?.content ?? "";
                    setContent(fetched);
                    setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, cachedContent: fetched } : t)));
                  });
              }
            }}
          >
            <span className="truncate max-w-[120px]">{changed ? "*" : ""} {tab.name}</span>
            <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="hover:text-red-400 transition">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="h-full">
        <Editor setChanged={setChanged} />
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center h-full text-neutral-500">Select a note to start editing</div>
  );
}
