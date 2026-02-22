"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import {
  FileIcon,
  FilePlus,
  FolderIcon,
  FolderPlusIcon,
  ChevronRight,
  ChevronDown,
  LogOutIcon,
  BrushIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import { apiFetch } from "@/app/lib/api";
import { useNote } from "@/app/contexts/NotesContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useUI } from "@/app/contexts/AlertContext";

type Doc = {
  _id: string;
  name: string;
  type: "folder" | "note" | "board";
  parentId: string | null;
  content: string | null;
  order: number;
};

export default function NotesList() {
  const { user, logout } = useAuth();
  const { docs, refreshDocs, setSelectedDocId , setContent} = useNote();
  const { showAlert } = useUI();

  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState<"note" | "board" | null>(null);

  // =============================
  // LOAD DOCUMENTS (ONCE)
  // =============================
  useEffect(() => {
    refreshDocs();
  }, []); // 🔥 DO NOT depend on refreshDocs

  // =============================
  // BUILD TREE MAP
  // =============================
  const childrenMap = useMemo(() => {
    const map: Record<string, Doc[]> = {};
    if (!Array.isArray(docs)) return map;

    docs.forEach((doc) => {
      const parent = doc.parentId || "root";
      if (!map[parent]) map[parent] = [];
      map[parent].push(doc);
    });

    Object.values(map).forEach((list) =>
      list.sort((a, b) => a.order - b.order)
    );

    return map;
  }, [docs]);

  // =============================
  // HELPERS
  // =============================
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getParentForNewItem = () => {
    if (!selectedId) return null;
    const selectedDoc = docs.find((d) => d._id === selectedId);
    if (selectedDoc?.type === "folder") return selectedDoc._id;
    return selectedDoc?.parentId ?? null;
  };

  // =============================
  // CREATE FOLDER
  // =============================
  const addFolder = async () => {
    const name = prompt("Folder name?");
    if (!name) return;

    try {
      await apiFetch("/fileTree/addFolder", {
        method: "POST",
        body: JSON.stringify({
          name,
          parentId: getParentForNewItem(),
          order: Date.now(),
        }),
      });

      await refreshDocs();
    } catch {
      showAlert("Error creating folder", "error");
    }
  };

  // =============================
  // CREATE NOTE / BOARD
  // =============================
  const createDocument = async () => {
    if (!docName || !docType) return;

    try {
      const endpoint =
        docType === "note"
          ? "/fileTree/addNote"
          : "/fileTree/addBoard";

      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          name: docName,
          parentId: getParentForNewItem(),
          order: Date.now(),
          content: "",
        }),
      });

      await refreshDocs();

      setDialogOpen(false);
      setDocName("");
      setDocType(null);
    } catch {
      showAlert("Error creating document", "error");
    }
  };

  // =============================
  // OPEN DOCUMENT
  // =============================
const openDocument = async (doc: Doc) => {
  setSelectedId(doc._id);
  setSelectedDocId(doc._id);

  try {
    if (doc.type === "note") {
      const res = await apiFetch("/fileTree/getNoteById", {
        method: "POST",
        body: JSON.stringify({ noteID: doc._id }),
      });

      const data = await res.json();
      const note = Array.isArray(data) ? data[0] : data;

      // 🔥 DIRECTLY update content state in context
      setContent(note?.content ?? "");
    }

    if (doc.type === "board") {
      const res = await apiFetch("/fileTree/getBoardById", {
        method: "POST",
        body: JSON.stringify({ boardID: doc._id }),
      });
      console.log("hi")
      const data = await res.json();
      const board = Array.isArray(data) ? data[0] : data;

      setContent(board?.content ?? "");
    }
  } catch (err) {
    console.error(err);
  }
};

  // =============================
  // RENDER TREE
  // =============================
  const renderChildren = (parentId: string) => {
    const children = childrenMap[parentId];
    if (!children) return null;

    return (
      <ul className="ml-4 border-l border-border pl-2 space-y-1">
        {children.map((doc) => (
          <li key={doc._id}>
            <div
              onClick={(e) => {
                e.stopPropagation();

                if (doc.type === "folder") {
                  toggleExpand(doc._id);
                  setSelectedId(doc._id);
                } else {
                  openDocument(doc);
                }
              }}
              className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors
              ${
                selectedId === doc._id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50"
              }`}
            >
              {doc.type === "folder" &&
                (expanded.has(doc._id) ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                ))}

              {doc.type === "folder" && (
                <FolderIcon size={16} className="text-primary" />
              )}

              {doc.type === "note" && (
                <FileIcon size={16} className="text-emerald-500" />
              )}

              {doc.type === "board" && (
                <BrushIcon size={16} className="text-purple-500" />
              )}

              <span className="truncate text-sm">{doc.name}</span>
            </div>

            {doc.type === "folder" &&
              expanded.has(doc._id) &&
              renderChildren(doc._id)}
          </li>
        ))}
      </ul>
    );
  };

  // =============================
  // UI
  // =============================
  return (
    <>
      <div className="flex w-full h-screen">
        <div className="w-[280px] border-r border-border flex flex-col p-4 bg-card">
          <div className="font-bold text-lg mb-6">DAAVAT.</div>

          <div className="flex gap-2 mb-4">
            <Button
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={addFolder}
            >
              <FolderPlusIcon size={14} className="mr-2" />
              Folder
            </Button>

            <Button
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={() => setDialogOpen(true)}
            >
              <FilePlus size={14} className="mr-2" />
              New
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto -ml-2">
            {renderChildren("root")}
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <img
                className="w-6 h-6 rounded-full"
                src={`https://ui-avatars.com/api/?name=${user?.name}`}
                alt="avatar"
              />
              <span className="text-xs text-muted-foreground">
                {user?.name}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={logout}
            >
              <LogOutIcon size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
            <DialogDescription>
              Choose type and give it a name.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex gap-2">
              <Button
                variant={docType === "note" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setDocType("note")}
              >
                <FileIcon size={16} />
                Text Note
              </Button>

              <Button
                variant={docType === "board" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setDocType("board")}
              >
                <BrushIcon size={16} />
                Board
              </Button>
            </div>

            <Input
              placeholder="Document name..."
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createDocument} disabled={!docName || !docType}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}