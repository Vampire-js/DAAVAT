"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
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
  type: "folder" | "note" | "board";
  parentId: string | null;
  content: string | null;
  order: number;
  references?: Reference[];
};

type NoteContextType = {
  docs: Doc[];
  folders: Doc[];
  refreshDocs: () => Promise<void>;

  selectedDocId: string | null;
  setSelectedDocId: (id: string | null) => void;

  content: string | undefined;
  setContent: (text: string | undefined) => void;

  name: string | null;
  setName: (text: string | null) => void;

  addNote: (note: {
    title: string;
    content: string;
    parentId?: string | null;
    references?: Omit<Reference, "id">[];
  }) => Promise<void>;

  addDocument: (doc: {
    title: string;
    content: string;
    type: "note" | "board";
    parentId?: string | null;
    references?: Omit<Reference, "id">[];
  }) => Promise<void>;

  references: Reference[];
  setReferences: (refs: Reference[]) => void;
  addReference: (ref: Omit<Reference, "id">) => Promise<void>;
};

const NoteContext = createContext<NoteContextType | null>(null);

export function NoteProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [content, setContent] = useState<string | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);

  // 🔥 Sync selected document state
  useEffect(() => {
    if (selectedDocId) {
      const activeDoc = docs.find((d) => d._id === selectedDocId);
      if (activeDoc) {
        setContent(activeDoc.content || "");
        setName(activeDoc.name);

        if (activeDoc.type === "note") {
          setReferences(activeDoc.references || []);
        } else {
          setReferences([]);
        }
      }
    } else {
      setReferences([]);
      setContent("");
      setName("");
    }
  }, [selectedDocId, docs]);

  // 🔥 Fetch documents
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

  useEffect(() => {
    refreshDocs();
  }, [refreshDocs]);

  // 🔥 Unified Add Document (note + board)
  const addDocument = async (newDoc: {
    title: string;
    content: string;
    type: "note" | "board";
    parentId?: string | null;
    references?: Omit<Reference, "id">[];
  }) => {
    try {
      const endpoint =
        newDoc.type === "note"
          ? "/fileTree/addNote"
          : "/fileTree/addBoard";

      const refsWithIds =
        newDoc.type === "note"
          ? newDoc.references?.map((r) => ({
              ...r,
              id: Math.random().toString(36).substring(2, 9),
            })) || []
          : [];

      const response = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          name: newDoc.title,
          content: newDoc.content,
          parentId: newDoc.parentId || null,
          order: Date.now(),
          references: refsWithIds,
        }),
      });

      if (!response.ok) throw new Error("Failed to save document");

      const savedDoc = await response.json();

      // Optimistic update
      setDocs((prev) => [...prev, savedDoc]);
      setSelectedDocId(savedDoc._id);

      refreshDocs();
    } catch (error) {
      console.error("Error adding document:", error);
    }
  };

  // 🔥 Backwards-compatible wrapper
  const addNote = async (note: {
    title: string;
    content: string;
    parentId?: string | null;
    references?: Omit<Reference, "id">[];
  }) => {
    return addDocument({
      ...note,
      type: "note",
    });
  };

  // 🔥 Add Reference (only works for notes)
  const addReference = useCallback(
    async (ref: Omit<Reference, "id">) => {
      if (!selectedDocId) return;

      const activeDoc = docs.find((d) => d._id === selectedDocId);
      if (!activeDoc || activeDoc.type !== "note") return;

      const newRef = { ...ref, id: Date.now().toString() };
      const updatedReferences = [...references, newRef];

      setReferences(updatedReferences);

      try {
        const response = await apiFetch("/fileTree/updateNote", {
          method: "POST",
          body: JSON.stringify({
            noteID: selectedDocId,
            content: content,
            references: updatedReferences,
          }),
        });

        if (!response.ok)
          throw new Error("Failed to sync references to server");

        refreshDocs();
      } catch (err) {
        console.error("Error saving reference:", err);
      }
    },
    [selectedDocId, references, content, docs, refreshDocs]
  );

  const folders = docs.filter((d) => d.type === "folder");

  return (
    <NoteContext.Provider
      value={{
        docs,
        setDocs,
        folders,
        refreshDocs,
        selectedDocId,
        setSelectedDocId,
        content,
        setContent,
        name,
        setName,
        addNote,
        addDocument,
        references,
        setReferences,
        addReference,
      }}
    >
      {children}
    </NoteContext.Provider>
  );
}

export function useNote() {
  const ctx = useContext(NoteContext);
  if (!ctx)
    throw new Error("useNote must be used inside <NoteProvider>");
  return ctx;
}
