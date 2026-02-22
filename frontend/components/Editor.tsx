"use client";

import { useEffect, useState, useMemo, useRef } from "react"; // Added useRef
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
  
  // Use a ref to track the last content we successfully loaded into the editor
  // This prevents infinite loops when content is updated via editor.onChange
  const lastLoadedContent = useRef<string | undefined>("");

  const activeDoc = useMemo(
    () => docs.find((d) => d._id === selectedDocId),
    [docs, selectedDocId]
  );

  // ==========================
  // LOAD & SYNC CONTENT
  // ==========================
  useEffect(() => {
    if (!editor || !activeDoc || activeDoc.type !== "note") return;

    // Only update the editor if the context content differs from what we last loaded
    // This allows background updates (like YouTube summaries) to be reflected
    if (content === lastLoadedContent.current) return;

    const loadContent = async () => {
      if (!content) {
        editor.replaceBlocks(editor.document, []);
      } else {
        try {
          const parsed = JSON.parse(content);
          editor.replaceBlocks(editor.document, parsed);
        } catch {
          // Fallback for plain text (like the initial "Magic" summary)
          editor.replaceBlocks(editor.document, [
            {
              type: "paragraph",
              content: [{ type: "text", text: content }],
            },
          ] as any);
        }
      }
      lastLoadedContent.current = content;
    };

    loadContent();
  }, [editor, activeDoc, content, selectedDocId]);

  // ==========================
  // HANDLE CHANGES (SAVE TO CONTEXT)
  // ==========================
  useEffect(() => {
    if (!editor || !activeDoc || activeDoc.type !== "note") return;

    const unsubscribe = editor.onChange(() => {
      const json = JSON.stringify(editor.document);
      
      // Update our ref so the "LOAD" effect knows this change came from the editor
      lastLoadedContent.current = json;
      
      setContent(json);
      setChanged(true);
    });

    return unsubscribe;
  }, [editor, activeDoc, setContent, setChanged]);

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

  if (!activeDoc || activeDoc.type !== "note") {
    return null;
  }

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