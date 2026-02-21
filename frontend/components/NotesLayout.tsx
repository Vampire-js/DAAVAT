"use client";

import { useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import NotesList from "./NotesList";
import NotesRenderer from "./NotesRenderer";
import Tools from "./Tools";
import { RagDoubtSolver } from "@/components/tools/RagDoubtSolver"; 

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
    <div className="relative h-screen bg-background overflow-hidden text-foreground">
      <PanelGroup direction="horizontal" className="h-full">
        
        {/* Left Panel Sidebar: Lighter Gray (bg-card) */}
        <Panel 
          defaultSize={20} 
          minSize={20} 
          maxSize={30} 
          className="border-r border-border bg-card"
        >
          <NotesList />
        </Panel>

        {/* Minimalist Resize Handle: Razor-thin line */}
        <PanelResizeHandle className="w-[1px] bg-border hover:bg-muted-foreground/20 transition-colors cursor-col-resize" />

        {/* Center Panel Editor: Deepest Gray (bg-background) */}
        <Panel minSize={40}>
          <div className="h-full w-full flex flex-col relative bg-background">
            
            {/* The Note Editor/Renderer */}
            <div className="flex-1 overflow-y-auto min-h-0 pb-32 scroll-smooth custom-scrollbar">
               <NotesRenderer />
            </div>

            {/* AI Input Overlay - Maintained floating logic */}
            <div className="absolute bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none">
                <div className="pointer-events-auto w-full max-w-2xl px-6">
                    <RagDoubtSolver />
                </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-[1px] bg-border hover:bg-muted-foreground/20 transition-colors cursor-col-resize" />

        {/* Right Panel Tools: Intermediate Gray (bg-secondary/30) */}
        <Panel
          defaultSize={4}
          minSize={15}
          collapsedSize={4}
          collapsible
          ref={toolsPanelRef}
          onCollapse={() => setIsToolsOpen(false)}
          onExpand={() => setIsToolsOpen(true)}
          className="border-l border-border bg-secondary/30 transition-all duration-300 ease-in-out"
        >
          <Tools isCollapsed={!isToolsOpen} setCollapsed={toggleToolsPanel} />
        </Panel>

      </PanelGroup>
    </div>
  );
}