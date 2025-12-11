"use client";

import { useNote } from "@/app/contexts/NotesContext";
import { Editor as BlocksEditor } from "@/components/blocks/editor-00/editor";
import "./themes/editor-theme.css";

interface EditorProps {
  setChanged: (changed: boolean) => void;
}

export default function Editor({ setChanged }: EditorProps) {
  const { setContent, content, selectedNoteId } = useNote();

  // Try to parse the saved content into SerializedEditorState if possible
  let parsedState: any = undefined;
  if (content) {
    try {
      parsedState = JSON.parse(content);
    } catch (e) {
      // content may be plain text or HTML — leave undefined so editor starts empty
      parsedState = undefined;
    }
  }

  return (
    <BlocksEditor
      namespace={selectedNoteId ?? undefined}
      editorSerializedState={parsedState}
      onSerializedChange={(value) => {
        try {
          setContent(JSON.stringify(value));
        } catch (e) {
          // fallback: store raw value
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          setContent(value as any);
        }
        setChanged(true);
      }}
    />
  );
}
