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
  const idRef = useRef(docId);

  useEffect(() => {
    idRef.current = docId;
  }, [docId]);

  useEffect(() => {
    let active = true; 
    if (!editor) return;

    const init = async () => {
      // Force immediate local unmount state
      setIsMounted(false);
      try {
        // Clear editor immediately
        editor.replaceBlocks(editor.document, [{ type: "paragraph", content: [] }]);

        if (initialContent && initialContent !== "undefined" && initialContent !== "") {
          let blocks;
          try {
            blocks = JSON.parse(initialContent);
          } catch {
            blocks = await editor.tryParseMarkdownToBlocks(initialContent);
          }
          
          if (active) {
            editor.replaceBlocks(editor.document, blocks);
          }
        }
      } catch (err) {
        console.error("Editor init error:", err);
      } finally {
        if (active) {
          // 50ms delay lets Lexical's internal reconciler finish its 'headless' check
          setTimeout(() => {
            if (active) setIsMounted(true);
          }, 50); 
        }
      }
    };

    init();

    return () => {
      active = false;
      setIsMounted(false);
      
      // CRITICAL: Force an empty state on unmount. 
      // This cancels Lexical's pending 'notify' and 'isHeadless' reconciliation tasks
      // by making the internal tree empty before the DOM node is destroyed.
      try {
        editor.replaceBlocks(editor.document, []);
      } catch (e) {
        // Silent catch for disposal errors
      }
    };
  }, [editor, initialContent]);

  useEffect(() => {
    if (!editor || !isMounted) return;

    const unsub = editor.onChange(() => {
      // Guard: Ensure document exists and ID matches before saving
      if (isMounted && editor.document && idRef.current === docId) {
        onSave(JSON.stringify(editor.document));
      }
    });

    return () => {
      if (unsub) unsub();
    };
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

  /**
   * CRITICAL CHECK: 
   * If content is 'undefined', the NotesContext is currently switching between documents.
   * Returning null here forces the old Editor instance to unmount before the new content 
   * is available, preventing the "stale content" bug.
   */
  if (!activeDoc || activeDoc.type !== "note" || content === undefined) return null;

  return (
    <div className="bg-background w-full h-full overflow-y-auto custom-scrollbar">
      <div className="p-8 max-w-5xl mx-auto pb-96">
        {/* The key={selectedDocId} forces a hard remount on every document switch */}
        <BlockNoteInternal 
          key={selectedDocId} 
          docId={selectedDocId}
          initialContent={content} 
          onSave={handleSave}
        />
      </div>
    </div>
  );
}