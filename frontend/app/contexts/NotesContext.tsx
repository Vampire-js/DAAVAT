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
  folders: Doc[]; 
  refreshDocs: () => Promise<void>;
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  content: string | undefined;
  setContent: (text: string | undefined) => void;
  name: string | null;
  setName: (text: string | null) => void;
  // 🔥 Updated signature to accept references and return the created Doc
  addNote: (note: { 
    title: string; 
    content: string; 
    parentId?: string | null; 
    tags?: string[]; 
    references?: Omit<Reference, 'id'>[] 
  }) => Promise<Doc>; 
  updateNote: (noteID: string, updates: Partial<Doc>) => Promise<void>; // 🔥 Add this
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

  // 🔥 Add the updateNote function logic
  const updateNote = useCallback(async (noteID: string, updates: Partial<Doc>) => {
    try {
      const response = await apiFetch("/fileTree/updateNote", {
        method: "POST",
        body: JSON.stringify({
          noteID,
          ...updates // Sends content, references, etc.
        }),
      });

      if (!response.ok) throw new Error("Failed to update note");

      // Update local state immediately so the editor reflects changes
      setDocs((prev) =>
        prev.map((doc) => (doc._id === noteID ? { ...doc, ...updates } : doc))
      );
      
      await refreshDocs(); // Sync with server
    } catch (err) {
      console.error("Error updating note:", err);
      throw err;
    }
  }, [refreshDocs]);

  const addReference = useCallback(async (ref: Omit<Reference, 'id'>) => {
    if (!selectedNoteId) return;

    const newRef = { ...ref, id: Date.now().toString() };
    const updatedReferences = [...references, newRef];

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

  const addNote = async (newNote: { 
    title: string; 
    content: string; 
    parentId?: string | null; 
    tags?: string[]; 
    references?: Omit<Reference, 'id'>[] 
  }) => {
    try {
      const refsWithIds = newNote.references?.map(r => ({
        ...r,
        id: Math.random().toString(36).substring(2, 9)
      })) || [];

      const response = await apiFetch("/fileTree/addNote", {
        method: "POST",
        body: JSON.stringify({
          name: newNote.title,
          content: newNote.content,
          parentId: newNote.parentId || null, 
          order: Date.now(),
          references: refsWithIds 
        }),
      });

      if (!response.ok) throw new Error("Failed to save note");
      const savedNote = await response.json();
      
      setDocs(prev => [...prev, savedNote]);
      setSelectedNoteId(savedNote._id);
      refreshDocs();

      return savedNote; 
    } catch (error) {
      console.error("Error adding note:", error);
      throw error; 
    }
  };

  const folders = docs.filter((d) => d.type === "folder");

  return (
    <NoteContext.Provider value={{ 
      docs, folders, refreshDocs, selectedNoteId, setSelectedNoteId, 
      content, setContent, name, setName, addNote, updateNote,
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