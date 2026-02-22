"use client";

import { useEffect, useState, useMemo } from "react";
import { useNote } from "@/app/contexts/NotesContext";
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { useTheme } from "next-themes";

type EditorProps = {
  setChanged: (v: boolean) => void;
};

export default function Editor({ setChanged }: EditorProps) {
  const {
    docs,
    content,
    setContent,
    selectedDocId,
  } = useNote();

  const editor = useCreateBlockNote();
  const { theme } = useTheme();

  const activeDoc = useMemo(
    () => docs.find((d) => d._id === selectedDocId),
    [docs, selectedDocId]
  );

  const [hasLoaded, setHasLoaded] = useState(false);

  // ==========================
  // LOAD CONTENT (ONLY FOR NOTES)
  // ==========================
  useEffect(() => {
    if (!editor || !activeDoc) return;

    // 🚫 If not a note → don't load into BlockNote
    if (activeDoc.type !== "note") return;

    if (!content) {
      editor.replaceBlocks(editor.document, []);
      return;
    }

    try {
      const parsed = JSON.parse(content);
      editor.replaceBlocks(editor.document, parsed);
    } catch {
      editor.replaceBlocks(editor.document, [
        {
          type: "paragraph",
          content: [{ type: "text", text: content }],
        },
      ] as any);
    }

    setHasLoaded(true);
  }, [editor, activeDoc, selectedDocId]);

  // ==========================
  // HANDLE CHANGES
  // ==========================
  useEffect(() => {
    if (!editor || !activeDoc) return;
    if (activeDoc.type !== "note") return;

    const unsubscribe = editor.onChange(() => {
      const json = JSON.stringify(editor.document);
      setContent(json);
      setChanged(true);
    });

    return unsubscribe;
  }, [editor, activeDoc, setContent, setChanged]);

  // Reset when switching documents
  useEffect(() => {
    setHasLoaded(false);
  }, [selectedDocId]);

  // ==========================
  // CTRL + S
  // ==========================
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("save_note"));
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ==========================
  // SAFETY CHECK
  // ==========================
  if (!activeDoc || activeDoc.type !== "note") {
    return null; // Only render for notes
  }

  // ==========================
  // RENDER
  // ==========================
  return (
    <div className="bg-background w-full h-full overflow-y-auto custom-scrollbar">
      <div className="p-8 max-w-5xl mx-auto pb-96">
        <BlockNoteView
          editor={editor}
          theme={theme === "dark" ? "dark" : "light"}
          className="bg-transparent"
        />
      </div>
    </div>
  );
}