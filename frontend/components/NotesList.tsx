"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import {
  FileIcon,
  FilePlus,
  FolderIcon,
  FolderPlusIcon,
  NotebookIcon,
  GitGraphIcon,
  ChevronRight,
  ChevronDown,
  LogOutIcon
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";
import { useNote } from "@/app/contexts/NotesContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useUI } from "@/app/contexts/AlertContext"; // Remove if you don't use AlertContext

type Doc = {
  _id: string;
  name: string;
  type: "folder" | "note";
  parentId: string | null;
  content: string | null;
  order: number;
};

export default function NotesList() {
  const { user, logout } = useAuth();
  const { setSelectedNoteId, setName, setContent } = useNote();
  const { showAlert } = useUI(); 

  const [docs, setDocs] = useState<Doc[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // --- 1. Load Documents (The New Unified Call) ---
  const loadDocs = async () => {
    try {
      const res = await apiFetch("/fileTree/documents");
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) setDocs(data);
    } catch (err) {
      console.error("Failed to load documents", err);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  // --- 2. Build Tree Structure ---
  const childrenMap = useMemo(() => {
    const map: Record<string, Doc[]> = {};
    if (!Array.isArray(docs)) return map;

    docs.forEach(doc => {
      const parent = doc.parentId && doc.parentId !== "null" ? doc.parentId : "root";
      if (!map[parent]) map[parent] = [];
      map[parent].push(doc);
    });

    // Sort by order
    Object.values(map).forEach(list => list.sort((a, b) => a.order - b.order));
    return map;
  }, [docs]);

  // --- 3. Actions ---
  const getParentForNewItem = () => {
    if (!selectedId) return null;
    const sel = docs.find(d => d._id === selectedId);
    if (sel?.type === "folder") return sel._id;
    return sel?.parentId ?? null;
  };

  const addFolder = async () => {
    const name = prompt("Folder name?");
    if (!name) return;
    try {
      await apiFetch("/fileTree/addFolder", {
        method: "POST",
        body: JSON.stringify({ name, parentId: getParentForNewItem(), order: Date.now() })
      });
      loadDocs();
    } catch (e) { console.error(e); }
  };

  const addNote = async () => {
    const name = prompt("Note name?");
    if (!name) return;
    try {
      await apiFetch("/fileTree/addNote", {
        method: "POST",
        body: JSON.stringify({ name, parentId: getParentForNewItem(), order: Date.now(), content: "" })
      });
      loadDocs();
    } catch (e) { console.error(e); }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // --- 4. Recursive Render ---
  const renderChildren = (parentId: string) => {
    const children = childrenMap[parentId];
    if (!children) return null;

    return (
      <ul className="ml-4 border-l border-white/5 pl-2 space-y-1">
        {children.map(doc => (
          <li key={doc._id}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (doc.type === 'folder') {
                  toggleExpand(doc._id);
                  setSelectedId(doc._id);
                } else {
                  setSelectedNoteId(doc._id);
                  setName(doc.name);
                  setSelectedId(doc._id);
                  // Fetch Content
                  apiFetch("/fileTree/getNoteById", {
                    method: "POST",
                    body: JSON.stringify({ noteID: doc._id })
                  }).then(res => res.json()).then(data => setContent(data.content));
                }
              }}
              className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer select-none transition-colors
                ${selectedId === doc._id ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800/50"}`}
            >
              {doc.type === 'folder' && (
                expanded.has(doc._id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              )}
              {doc.type === 'folder' ? <FolderIcon size={16} className="text-blue-400" /> : <FileIcon size={16} className="text-emerald-400" />}
              <span className="truncate text-sm">{doc.name}</span>
            </div>
            {doc.type === 'folder' && expanded.has(doc._id) && renderChildren(doc._id)}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="flex w-full h-screen bg-[#0a0a0a]">
      {/* Sidebar Icons */}
      <div className="w-12 border-r border-white/10 flex flex-col items-center py-4 gap-4 bg-neutral-950">
         <img src="/Logo.svg" className="w-6 opacity-80" alt="Logo" />
         <Button variant="ghost" size="icon" className="text-neutral-400"><NotebookIcon/></Button>
         <Button variant="ghost" size="icon" className="text-neutral-400"><GitGraphIcon/></Button>
      </div>

      {/* File Tree Panel */}
      <div className="w-[280px] border-r border-white/10 flex flex-col p-4 bg-neutral-950/50">
        <div className="font-bold text-neutral-200 text-lg mb-6 tracking-tight">DAAVAT.</div>
        
        <div className="flex gap-2 mb-4">
          <Button variant="outline" className="flex-1 h-8 text-xs bg-neutral-900 border-neutral-800" onClick={addFolder}>
            <FolderPlusIcon size={14} className="mr-2" /> Folder
          </Button>
          <Button variant="outline" className="flex-1 h-8 text-xs bg-neutral-900 border-neutral-800" onClick={addNote}>
            <FilePlus size={14} className="mr-2" /> Note
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto -ml-2">
          {renderChildren("root")}
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
             <img className="w-6 h-6 rounded-full" src={`https://ui-avatars.com/api/?name=${user?.name}`} />
             <span className="text-xs text-neutral-400">{user?.name}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-red-400" onClick={logout}>
            <LogOutIcon size={14}/>
          </Button>
        </div>
      </div>
    </div>
  );
}