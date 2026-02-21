"use client";
import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { apiFetch } from "@/app/lib/api";

export type Reference = {
  id: string;
  source: "YouTube" | "PDF" | "Audio";
  title: string;
  content: string;
};

type Doc = {
  _id: string;
  name: string;
  type: "folder" | "note";
  parentId: string | null;
  content: string | null;
  order: number;
  references?: Reference[]; 
};

type NoteContextType = {
  docs: Doc[];
  folders: Doc[]; // Add this line
  refreshDocs: () => Promise<void>;
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  content: string | undefined;
  setContent: (text: string | undefined) => void;
  name: string | null;
  setName: (text: string | null) => void;
  // 🔥 Updated signature to accept references
  addNote: (note: { 
    title: string; 
    content: string; 
    parentId?: string | null; // 1. Add this line
    tags?: string[]; 
    references?: Omit<Reference, 'id'>[] 
  }) => Promise<void>;
  references: Reference[];
  setReferences: (refs: Reference[]) => void;
  addReference: (ref: Omit<Reference, 'id'>) => Promise<void>;
};

const NoteContext = createContext<NoteContextType | null>(null);

export function NoteProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [content, setContent] = useState<string | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);

  // 1. Sync State with Docs Array
  // This ensures that when you click a note in the sidebar, 
  // the Editor sees the content and the sources from the DB.
  useEffect(() => {
    if (selectedNoteId) {
      const activeNote = docs.find((d) => d._id === selectedNoteId);
      if (activeNote) {
        setContent(activeNote.content || "");
        setName(activeNote.name);
        setReferences(activeNote.references || []);
      }
    } else {
      setReferences([]);
      setContent("");
      setName("");
    }
  }, [selectedNoteId, docs]);

  const refreshDocs = useCallback(async () => {
    try {
      const res = await apiFetch("/fileTree/documents");
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) setDocs(data);
    } catch (err) {
      console.error("Failed to load documents", err);
    }
  }, []);

  // 2. Initial load of documents
  useEffect(() => {
    refreshDocs();
  }, [refreshDocs]);

  // 3. Updated addReference to use your existing /updateNote route
  const addReference = useCallback(async (ref: Omit<Reference, 'id'>) => {
    if (!selectedNoteId) return;

    const newRef = { ...ref, id: Date.now().toString() };
    const updatedReferences = [...references, newRef];

    // Optimistic Update (Immediate UI response)
    setReferences(updatedReferences);

    try {
      const response = await apiFetch("/fileTree/updateNote", {
        method: "POST",
        body: JSON.stringify({
          noteID: selectedNoteId,
          content: content,
          references: updatedReferences 
        }),
      });

      if (!response.ok) throw new Error("Failed to sync references to server");
      
      await refreshDocs();
    } catch (err) {
      console.error("Error saving reference:", err);
    }
  }, [selectedNoteId, references, content, refreshDocs]);

  // 🔥 UPDATED: Now accepts references, sends them to backend, and updates local state instantly
  const addNote = async (newNote: { 
    title: string; 
    content: string; 
    parentId?: string | null; // 1. Add this line
    tags?: string[]; 
    references?: Omit<Reference, 'id'>[] 
  }) => {
    try {
      // 1. Generate IDs for the references
      const refsWithIds = newNote.references?.map(r => ({
        ...r,
        id: Math.random().toString(36).substring(2, 9)
      })) || [];

      // Find the apiFetch call inside addNote:
      const response = await apiFetch("/fileTree/addNote", {
        method: "POST",
        body: JSON.stringify({
          name: newNote.title,
          content: newNote.content,
          parentId: newNote.parentId || null, // 2. Change this line
          order: Date.now(),
          // 2. 🔥 ACTUALLY SEND THE DATA TO BACKEND
          references: refsWithIds 
        }),
      });

      if (!response.ok) throw new Error("Failed to save note");
      const savedNote = await response.json();
      
      // 3. 🔥 STABILITY FIX: Manually update the docs list before switching ID.
      // This stops the race condition where the UI loads before refreshDocs() finishes.
      setDocs(prev => [...prev, savedNote]);
      
      // Trigger the selection - useEffect will now find 'savedNote' immediately
      setSelectedNoteId(savedNote._id);
      
      // Background sync
      refreshDocs();
    } catch (error) {
      console.error("Error adding note:", error);
    }
  };

  // Inside NoteProvider component, calculate folders from docs
  const folders = docs.filter((d) => d.type === "folder");

  return (
    <NoteContext.Provider value={{ 
      docs, folders, refreshDocs, selectedNoteId, setSelectedNoteId, 
      content, setContent, name, setName, addNote,
      references, setReferences, addReference
    }}>
      {children}
    </NoteContext.Provider>
  );
}

export function useNote() {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error("useNote must be used inside <NoteProvider>");
  return ctx;
}