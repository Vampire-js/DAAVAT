"use client";

import { useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import NotesList from "./NotesList";
import NotesRenderer from "./NotesRenderer";
import Tools from "./Tools";
import { RagDoubtSolver } from "@/components/tools/RagDoubtSolver"; 
import QuizGenerator from "@/components/QuizGenerator";

export default function NotesLayout() {
  const toolsPanelRef = useRef<any>(null);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  const toggleToolsPanel = () => {
    if (!toolsPanelRef.current) return;

    if (isToolsOpen) {
      toolsPanelRef.current.collapse();
      setIsToolsOpen(false);
    } else {
      toolsPanelRef.current.expand();
      setIsToolsOpen(true);
    }
  };

  return (
    <div className="relative h-screen bg-neutral-950 overflow-hidden text-white">
      <PanelGroup direction="horizontal" className="h-full">
        
        {/* Left Panel: Notes List */}
        <Panel defaultSize={20} minSize={20} maxSize={30} className="border-r border-white/10">
          <NotesList />
        </Panel>

        <PanelResizeHandle className="w-1 bg-neutral-900 hover:bg-blue-500/50 transition-colors cursor-col-resize" />

        {/* Center Panel: Note Content + Overlay Tools */}
        <Panel minSize={40}>
          <div className="h-full w-full flex flex-col relative bg-neutral-900/50">
            
            {/* The Note Editor/Renderer */}
            <div className="flex-1 overflow-y-auto min-h-0 pb-20 scroll-smooth">
               <NotesRenderer />
            </div>

            {/* Floating Overlay Container for Doubt Solver & Quiz */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-6 flex flex-col justify-end pointer-events-none">
              {/* Force grid-cols-2 to keep them side-by-side on the same level */}
              <div className="max-w-[1400px] w-full mx-auto grid grid-cols-2 gap-6 items-end">
                  
                  {/* Left: Doubt Solver */}
                  <div className="w-full pointer-events-auto transition-all duration-300">
                      <RagDoubtSolver />
                  </div>

                  {/* Right: Quiz Generator */}
                  <div className="w-full pointer-events-auto transition-all duration-300">
                      <QuizGenerator />
                  </div>

              </div>
            </div>

          </div>
        </Panel>

        {/* Handle between Editor and Tools */}
        <PanelResizeHandle className="w-1 bg-neutral-900 hover:bg-blue-500/50 transition-colors cursor-col-resize" />

        {/* Right Panel: Tools (YouTube, PDF, etc.) */}
        <Panel
          defaultSize={4}
          minSize={15}
          collapsedSize={4}
          collapsible
          ref={toolsPanelRef}
          onCollapse={() => setIsToolsOpen(false)}
          onExpand={() => setIsToolsOpen(true)}
          className="border-l border-white/10 bg-neutral-950 transition-all duration-300 ease-in-out"
        >
          <Tools isCollapsed={!isToolsOpen} setCollapsed={toggleToolsPanel} />
        </Panel>

      </PanelGroup>
    </div>
  );
}