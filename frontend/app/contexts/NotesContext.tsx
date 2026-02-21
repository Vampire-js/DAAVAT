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
import { useAuth } from "./AuthContext";

/* ================= TYPES ================= */

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
  }) => Promise<Doc>;

  addDocument: (doc: {
    title: string;
    content: string;
    type: "note" | "board";
    parentId?: string | null;
    references?: Omit<Reference, "id">[];
  }) => Promise<Doc>;

  updateNote: (noteID: string, updates: Partial<Doc>) => Promise<void>;

  references: Reference[];
  setReferences: (refs: Reference[]) => void;
  addReference: (ref: Omit<Reference, "id">) => Promise<void>;

  globalProgress: number | null;
  setGlobalProgress: (val: number | null) => void;
  isTransitioning: boolean; 
};

/* ================= CONTEXT ================= */

const NoteContext = createContext<NoteContextType | null>(null);

export function NoteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDocId, _setSelectedDocId] = useState<string | null>(null);
  const [content, setContent] = useState<string | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [globalProgress, setGlobalProgress] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false); 

  /* ================= FETCH DOCS ================= */

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

  /* ================= RESET ON LOGOUT/SWITCH ================= */
  useEffect(() => {
    setDocs([]);
    _setSelectedDocId(null);
    setContent(undefined);
    setReferences([]);
    setName(null);

    if (user) {
      refreshDocs();
    }
  }, [user?.id, refreshDocs]);

  /* ================= SYNC SELECTED DOC & TRANSITION LOCK ================= */

  // Lock updates immediately on click to prevent "bleeding" from old content
  const setSelectedDocId = useCallback((id: string | null) => {
    setIsTransitioning(true); 
    _setSelectedDocId(id);
  }, []);

  useEffect(() => {
    if (!selectedDocId) {
      setContent("");
      setName("");
      setReferences([]);
      setIsTransitioning(false);
      return;
    }

    // IMMEDIATELY clear content to prevent bleeding
    setContent(undefined); 

    const activeDoc = docs.find((d) => d._id === selectedDocId);
    if (!activeDoc) return;

    // Load data into states
    setContent(activeDoc.content || "");
    setName(activeDoc.name);

    if (activeDoc.type === "note") {
      setReferences(activeDoc.references || []);
    } else {
      setReferences([]);
    }

    // Unlock updates after a longer buffer to ensure Editor has processed the new state
    const timer = setTimeout(() => setIsTransitioning(false), 100);
    
    return () => {
      clearTimeout(timer);
      setIsTransitioning(true); // Re-lock on unmount or doc switch
    };
  }, [selectedDocId, docs]);

  // Wrap setContent to ignore updates during transition
  const safeSetContent = useCallback((val: string | undefined) => {
    if (isTransitioning) return; 
    setContent(val);
  }, [isTransitioning]);

  /* ================= ADD DOCUMENT ================= */

  const addDocument = async (newDoc: {
    title: string;
    content: string;
    type: "note" | "board";
    parentId?: string | null;
    references?: Omit<Reference, "id">[];
  }): Promise<Doc> => {
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

      setDocs((prev) => [...prev, savedDoc]);
      _setSelectedDocId(savedDoc._id);

      await refreshDocs();
      return savedDoc;
    } catch (error) {
      console.error("Error adding document:", error);
      throw error;
    }
  };

  /* ================= ADD NOTE (wrapper) ================= */

  const addNote = async (note: {
    title: string;
    content: string;
    parentId?: string | null;
    references?: Omit<Reference, "id">[];
  }): Promise<Doc> => {
    return addDocument({
      ...note,
      type: "note",
    });
  };

  /* ================= UPDATE NOTE ================= */

  const updateNote = useCallback(
    async (noteID: string, updates: Partial<Doc>) => {
      try {
        const response = await apiFetch("/fileTree/updateNote", {
          method: "POST",
          body: JSON.stringify({
            noteID,
            ...updates,
          }),
        });

        if (!response.ok) throw new Error("Failed to update note");

        setDocs((prev) =>
          prev.map((doc) =>
            doc._id === noteID ? { ...doc, ...updates } : doc
          )
        );

        await refreshDocs();
      } catch (err) {
        console.error("Error updating note:", err);
        throw err;
      }
    },
    [refreshDocs]
  );

  /* ================= ADD REFERENCE ================= */

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
            content,
            references: updatedReferences,
          }),
        });

        if (!response.ok)
          throw new Error("Failed to sync references to server");

        await refreshDocs();
      } catch (err) {
        console.error("Error saving reference:", err);
      }
    },
    [selectedDocId, references, content, docs, refreshDocs]
  );

  /* ================= DERIVED ================= */

  const folders = docs.filter((d) => d.type === "folder");

  /* ================= PROVIDER ================= */

  return (
    <NoteContext.Provider
      value={{
        docs,
        folders,
        refreshDocs,
        selectedDocId,
        setSelectedDocId,
        content,
        setContent: safeSetContent, // Using the locked wrapper
        name,
        setName,
        addNote,
        addDocument,
        updateNote,
        references,
        setReferences,
        addReference,
        globalProgress,
        setGlobalProgress,
        isTransitioning, 
      }}
    >
      {children}
    </NoteContext.Provider>
  );
}

/* ================= HOOK ================= */

export function useNote() {
  const ctx = useContext(NoteContext);
  if (!ctx)
    throw new Error("useNote must be used inside <NoteProvider>");
  return ctx;
}