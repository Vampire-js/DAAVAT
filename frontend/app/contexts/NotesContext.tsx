"use client";
import { createContext, useContext, useState, ReactNode } from "react";

type NoteContextType = {
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  content: string | null;
  setContent: (text: string | null) => void;
  name: string | null;
  setName: (text: string | null) => void;
};

const NoteContext = createContext<NoteContextType | null>(null);

export function NoteProvider({ children }: { children: ReactNode }) {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null)

  return (
    <NoteContext.Provider value={{ selectedNoteId, setSelectedNoteId , content, setContent , name, setName }}>
      {children}
    </NoteContext.Provider>
  );
}

export function useNote() {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error("useNote must be used inside <NoteProvider>");
  return ctx;
}
