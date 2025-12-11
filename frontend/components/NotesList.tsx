"use client";

import { useEffect, useState } from "react";
import {
  FolderPlusIcon,
  FilePlus,
  FolderIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { apiFetch } from "@/app/lib/api";
import { useNote } from "@/app/contexts/NotesContext";
import { transcribeFile } from "@/app/lib/transcribe";

type Note = {
  id: string;
  name: string;
  createdAt: string;
  content?: string;
};

type Folder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  notes?: Note[];
};

type ApiFolder = {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type ApiNote = {
  _id: string;
  name: string;
  content?: string;
  createdAt: string;
};

export default function NotesList() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const { setSelectedNoteId, setContent, setName } = useNote();

  /* -------------------------------
     1) LOAD FOLDERS
  --------------------------------*/
  useEffect(() => {
    apiFetch("/fileTree/getFolders", { method: "GET" })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return setFolders([]);
        setFolders(
          data.map((f: ApiFolder) => ({
            id: f._id,
            name: f.name,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          }))
        );
      })
      .catch(() => setFolders([]));
  }, []);

  /* -------------------------------
     2) LOAD NOTES
  --------------------------------*/
  useEffect(() => {
    folders.forEach((folder) => {
      if (folder.notes) return;
      apiFetch("/fileTree/getNotes", {
        method: "POST",
        body: JSON.stringify({ folderID: folder.id }),
      })
        .then((res) => res.json())
        .then((notesData: ApiNote[]) => {
          setFolders((prev) =>
            prev.map((f) =>
              f.id === folder.id
                ? { ...f, notes: notesData.map((n) => ({ id: n._id, name: n.name, content: n.content, createdAt: n.createdAt })) }
                : f
            )
          );
        });
    });
  }, [folders]);

  /* -------------------------------
     3) ADD FOLDER
  --------------------------------*/
  const addFolder = async () => {
    const name = prompt("Folder name:");
    if (!name) return;
    const res = await apiFetch("/fileTree/addFolder", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const f = await res.json();
    if (!f?._id) return alert("Failed creating folder");
    setFolders((prev) => [...prev, { id: f._id, name: f.name, createdAt: f.createdAt, updatedAt: f.updatedAt, notes: [] }]);
  };

  /* -------------------------------
     4) ADD NOTE
  --------------------------------*/
  const addNote = async (title?: string, fileContent?: string) => {
    if (selectedFolder === null) return alert("Select folder first!");
    const noteTitle = title ?? prompt("Note title:");
    if (!noteTitle) return;

    const res = await apiFetch("/fileTree/addNote", {
      method: "POST",
      body: JSON.stringify({ name: noteTitle, folderID: folders[selectedFolder].id }),
    });
    const n = await res.json();
    if (!n?._id) return alert("Failed to create note");

    if (fileContent) {
      await apiFetch("/fileTree/updateNote", {
        method: "POST",
        body: JSON.stringify({ noteID: n._id, content: fileContent }),
      });
    }

    const note: Note = { id: n._id, name: n.name, createdAt: n.createdAt, content: fileContent ?? n.content };
    setFolders((prev) =>
      prev.map((f, i) => (i === selectedFolder ? { ...f, notes: [...(f.notes ?? []), note] } : f))
    );

    setName(note.name);
    setSelectedNoteId(note.id);
    setContent(note.content ?? "");
  };

  /* -------------------------------
     5) HANDLE FILE UPLOAD
  --------------------------------*/
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (selectedFolder === null) return alert("Select folder first");

    try {
      const data = await transcribeFile(file);
      const content = `# Transcript\n\n${data.transcript}\n\n# Summary\n\n${(data.summary || []).join("\n")}`;
      await addNote(file.name, content);
    } catch (err) {
      console.error("Transcription failed", err);
      alert("Failed to transcribe file");
    } finally {
      e.target.value = "";
    }
  };

  /* -------------------------------
     UI
  --------------------------------*/
  return (
    <div className="flex flex-col p-3 gap-3 h-full text-sm">
      {/* Action Bar */}
      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={addFolder}>
          <FolderPlusIcon size={18} />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={addNote}
          disabled={selectedFolder === null}
        >
          <FilePlus size={18} />
        </Button>

        <input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          id="audio-upload-input"
          className="hidden"
        />

        <Button
          variant="outline"
          size="icon"
          onClick={() => document.getElementById("audio-upload-input")?.click()}
        >
          Upload
        </Button>

        <div className="text-xs text-neutral-400">
          selFolder: {selectedFolder === null ? "none" : selectedFolder}
        </div>
      </div>

      {/* Folder / Notes Tree */}
      <Accordion type="multiple" className="w-full space-y-2">
        {folders.map((folder, i) => (
          <AccordionItem key={folder.id} value={folder.id}>
            <AccordionTrigger
              className={`px-3 ${selectedFolder === i ? "bg-neutral-900 text-white" : ""}`}
              onClick={() => setSelectedFolder(i)}
            >
              <span className="flex items-center gap-2">
                <FolderIcon size={18} /> {folder.name}
              </span>
            </AccordionTrigger>

            <AccordionContent className="pl-4 py-2">
              {folder.notes?.map((note) => (
                <div
                  key={note.id}
                  className="p-2 rounded hover:bg-neutral-900 cursor-pointer"
                  onClick={() => {
                    setName(note.name);
                    setSelectedNoteId(note.id);
                    apiFetch("/fileTree/getNoteById", {
                      method: "POST",
                      body: JSON.stringify({ noteID: note.id }),
                    })
                      .then((res) => res.json())
                      .then((d) => setContent(d?.[0]?.content ?? ""));
                  }}
                >
                  {note.name}
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
