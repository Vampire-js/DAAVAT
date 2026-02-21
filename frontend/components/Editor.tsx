"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNote } from "@/app/contexts/NotesContext";
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { useTheme } from "next-themes";

type EditorProps = {
  setChanged: (v: boolean) => void;
};

/**
 * INTERNAL COMPONENT: Owns the 'useCreateBlockNote' instance.
 * Remounting this component via a 'key' prop is the ONLY way to truly
 * destroy the previous editor's internal state and prevent "bleeding".
 */
function BlockNoteInternal({ 
  docId, 
  initialContent, 
  onSave 
}: { 
  docId: string; 
  initialContent: string; 
  onSave: (val: string) => void 
}) {
  const { theme } = useTheme();
  const editor = useCreateBlockNote();
  const [isMounted, setIsMounted] = useState(false);
  
  // Track current ID in a ref to block async saves to the wrong document
  const idRef = useRef(docId);

  useEffect(() => {
    if (!editor) return;

    const init = async () => {
      setIsMounted(false);
      try {
        // 1. Force clear the internal document to prevent flickering
        editor.replaceBlocks(editor.document, [{ type: "paragraph", content: [] }]);

        // 2. Load and stylize the new content
        if (initialContent && initialContent !== "undefined" && initialContent !== "") {
          try {
            // Try BlockNote JSON format
            const parsed = JSON.parse(initialContent);
            editor.replaceBlocks(editor.document, parsed);
          } catch {
            // Fallback: AI-generated Markdown/Raw Text stylized into blocks
            const blocks = await editor.tryParseMarkdownToBlocks(initialContent);
            editor.replaceBlocks(editor.document, blocks);
          }
        }
      } finally {
        setIsMounted(true);
      }
    };
    init();
  }, [editor]); // Runs ONLY once when this internal component mounts

  // Sync changes back to Context
  useEffect(() => {
    if (!editor || !isMounted) return;

    const unsub = editor.onChange(() => {
      // Logic Guard: Only allow save if we are still on the same document
      if (idRef.current === docId) {
        onSave(JSON.stringify(editor.document));
      }
    });
    return unsub;
  }, [editor, isMounted, docId, onSave]);

  return (
    <BlockNoteView
      editor={editor}
      theme={theme === "dark" ? "dark" : "light"}
      className="bg-transparent"
    />
  );
}

/**
 * MAIN EXPORT: Handles lifecycle and resets based on selectedDocId.
 */
export default function Editor({ setChanged }: EditorProps) {
  const { docs, content, setContent, selectedDocId } = useNote();

  const activeDoc = useMemo(
    () => docs.find((d) => d._id === selectedDocId),
    [docs, selectedDocId]
  );

  const handleSave = useCallback((val: string) => {
    if (val === content) return;
    setContent(val);
    setChanged(true);
  }, [content, setContent, setChanged]);

  if (!activeDoc || activeDoc.type !== "note") return null;

  return (
    <div className="bg-background w-full h-full overflow-y-auto custom-scrollbar">
      <div className="p-8 max-w-5xl mx-auto pb-96">
        {/* CRITICAL FIX: Adding key={selectedDocId} forces React to 
          completely destroy the previous editor instance immediately. 
          This prevents the "wrong content displayed" bug.
        */}
        <BlockNoteInternal 
          key={selectedDocId} 
          docId={selectedDocId}
          initialContent={content || ""} 
          onSave={handleSave}
        />
      </div>
    </div>
  );
}