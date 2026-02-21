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
import { useUI } from "@/app/contexts/AlertContext";

// Define the Doc type locally or import it if shared
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
  
  // 1. Consume docs and refreshDocs from Context instead of local state
  const { 
    docs, 
    refreshDocs, 
    setSelectedNoteId, 
    setName, 
    setContent 
  } = useNote();
  
  const { showAlert } = useUI(); 

  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 2. Initial load uses the global refresh function
  useEffect(() => {
    refreshDocs();
  }, [refreshDocs]);

  // 3. Tree structure now reacts to the global 'docs' array
  const childrenMap = useMemo(() => {
    const map: Record<string, Doc[]> = {};
    if (!Array.isArray(docs)) return map;

    docs.forEach(doc => {
      const parent = doc.parentId && doc.parentId !== "null" ? doc.parentId : "root";
      if (!map[parent]) map[parent] = [];
      map[parent].push(doc);
    });

    Object.values(map).forEach(list => list.sort((a, b) => a.order - b.order));
    return map;
  }, [docs]);

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
      // 4. Trigger global refresh so all components stay in sync
      refreshDocs(); 
    } catch (e) { 
      console.error(e); 
      showAlert("Error creating folder", "error");
    }
  };

  const addNote = async () => {
    const name = prompt("Note name?");
    if (!name) return;
    try {
      await apiFetch("/fileTree/addNote", {
        method: "POST",
        body: JSON.stringify({ name, parentId: getParentForNewItem(), order: Date.now(), content: "" })
      });
      // 5. Trigger global refresh
      refreshDocs();
    } catch (e) { 
      console.error(e); 
      showAlert("Error creating note", "error");
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
      <div className="w-12 border-r border-white/10 flex flex-col items-center py-4 gap-4 bg-neutral-950">
         <img src="/Logo.svg" className="w-6 opacity-80" alt="Logo" />
         <Button variant="ghost" size="icon" className="text-neutral-400"><NotebookIcon/></Button>
         <Button variant="ghost" size="icon" className="text-neutral-400"><GitGraphIcon/></Button>
      </div>

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

        <div className="flex-1 overflow-y-auto -ml-2" onClick={() => setSelectedId(null)}>
          {renderChildren("root")}
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
             <img className="w-6 h-6 rounded-full" src={`https://ui-avatars.com/api/?name=${user?.name}`} alt="avatar" />
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