"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import {
  FileIcon,
  FilePlus,
  FolderIcon,
  FolderPlusIcon,
  GitGraphIcon,
  NotebookIcon,
  ChevronRight,
  ChevronDown,
  LogOutIcon
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";
import { useNote } from "@/app/contexts/NotesContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useRouter } from "next/navigation";

type Doc = {
  _id: string;
  name: string;
  type: string;
  parentId: string | null;
  content: string | null;
  order: number;
};

export default function NotesList() {
    const router = useRouter();
    const {user, logout} = useAuth();


  const [docs, setDocs] = useState<Doc[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { setSelectedNoteId, setName, setContent } = useNote()

  
  const loadDocs = () => {
    apiFetch("/fileTree/documents")
      .then(r => r.json())
      .then(setDocs);
  };

  useEffect(loadDocs, []);

  // Build children lookup
  const childrenMap = useMemo(() => {
    const map: Record<string, Doc[]> = {};
    console.log(docs)
    docs.forEach(doc => {
      const parent =
        !doc.parentId ||
        doc.parentId === "null" ||
        doc.parentId === "" ||
        doc.parentId === "root"
          ? "root"
          : doc.parentId;

      if (!map[parent]) map[parent] = [];
      map[parent].push(doc);
    });

    Object.values(map).forEach(list =>
      list.sort((a, b) => a.order - b.order)
    );

    return map;
  }, [docs]);

  // --- ADD HANDLERS ---

  const getParentForNewItem = () => {
    if (!selectedId) return null;

    const sel = docs.find(d => d._id === selectedId);

    // If current selection is folder → add inside it
    if (sel?.type === "folder") return sel._id;

    // If a file is selected → add to its parent
    return sel?.parentId ?? null;
  };

  const addFolder = async () => {
    const name = prompt("Folder name?");
    if (!name) return;

    const order = Date.now();
    const parentId = getParentForNewItem();

    await apiFetch("/fileTree/addFolder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId, order })
    });

    loadDocs();
  };

  const addNote = async () => {
    const name = prompt("Note name?");
    if (!name) return;

    const order = Date.now();
    const parentId = getParentForNewItem();

    const docs = await apiFetch("/fileTree/addNote", {
       method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parentId,
        order,
        content: `# ${name}`
      })
    })


    loadDocs();
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  const renderChildren = (parentId: string) => {
    const children = childrenMap[parentId];
    if (!children) return null;

    return (
      <ul className="ml-4 text-sm space-y-1 w-full">
        {children.map(doc =>
          doc.type === "folder" ? (
            <li key={doc._id}>
              <div
                onClick={() => {
                  toggleExpand(doc._id);
                  setSelectedId(doc._id);
                }}
                className={`
                  flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer
                  transition
                  ${
                    selectedId === doc._id
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-300 hover:bg-neutral-800/60"
                  }
                `}
              >
                {expanded.has(doc._id)
                  ? <ChevronDown size={16} />
                  : <ChevronRight size={16} />}

                <FolderIcon size={18} className="opacity-80" />
                <span>{doc.name}</span>
              </div>

              {expanded.has(doc._id) && renderChildren(doc._id)}
            </li>
          ) : (
            <li key={doc._id}>
              <div
                className={`
                  flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer
                  transition
                  ${
                    selectedId === doc._id
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-300 hover:bg-neutral-800/60 hover:translate-x-[2px]"
                  }
                `}
                onClick={() =>{
                  setSelectedNoteId(doc._id)
                  setName(doc.name)
                  setSelectedId(doc._id)
                
                apiFetch("/fileTree/getNoteById", {
                method: "POST",
                body: JSON.stringify({ noteID: doc._id }),
              })
                .then((e) => e.json())
                .then((data) => setContent(data[0]?.content ?? ""));
                }}
                  
              >
                <FileIcon size={18} className="opacity-80" />
                <span>{doc.name}</span>
              </div>
            </li>
          )
        )}
      </ul>
    );
  };

  return (
    <div className="flex w-full h-full">
      {/* Sidebar */}
      <div className="side-bar p-2 flex flex-col items-center gap-3 border-r-2">
        <img src={"/Logo.svg"} className="w-6 mt-1" alt="Logo" />
        <Button className="bg-transparent text-white hover:bg-neutral-800 mt-2">
          <NotebookIcon size={20} />
        </Button>
        <Button className="bg-transparent text-white hover:bg-neutral-800">
          <GitGraphIcon size={20} />
        </Button>
      </div>

      {/* Main Section */}
      <div className="flex flex-col p-3 w-full">
        <div className="text-xl font-bold text-neutral-300">
          DAAVAT.
        </div>

        {/* GLOBAL CONTROLS */}
        <div className="flex gap-2 mt-5">
          <Button variant="outline" size="icon" onClick={addFolder}>
            <FolderPlusIcon size={18} />
          </Button>

          <Button variant="outline" size="icon" onClick={addNote}>
            <FilePlus size={18} />
          </Button>
        </div>

        {/* TREE */}
        <div className="-ml-3 mt-4 w-full h-full">
          {renderChildren("root")}
        </div>

          <div className="account-controls flex pb-5 items-center justify-between">
        
        <div className="flex gap-2 items-center"><div className="w-8">
          <img className="rounded-full" src={`https://ui-avatars.com/api/?name=${user?.name}&size=256`} />
        </div>
        <span className="text-lg text-stone-300">{user?.name}</span>
        </div>
        <Button className="bg-transparent text-white rounded-full hover:bg-stone-900" onClick={() => {
          setSelectedNoteId(null)
          setContent("")
          logout()
          }}>
          <LogOutIcon/>
        </Button>

      </div>
      </div>
    </div>
  );
}
