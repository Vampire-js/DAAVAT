// frontend/components/Tools.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  ChevronRight, 
  ChevronLeft, 
  HelpCircleIcon, 
  Mic,
  Sparkles 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import clsx from "clsx";
import Help from "./tools/Help";
import LiveTranscriber from "./tools/LiveTranscriber";
import UnifiedAddTool from "./tools/UnifiedAddTool";

type ToolKey = "live" | "help" | null;

export default function Tools({ isCollapsed, setCollapsed }: { isCollapsed: boolean; setCollapsed: () => void }) {
  const [activeTool, setActiveTool] = useState<ToolKey>("live");

  return (
    <div className="h-full flex flex-row-reverse overflow-hidden">
      
      <div className="flex flex-col gap-3 bg-neutral-900 border-l border-neutral-800 p-2 w-16 items-center shrink-0">
        
        {/* Toggle Sidebar */}
        <Button
          size="icon"
          variant="ghost"
          className="text-neutral-500 hover:text-white hover:bg-neutral-800 mb-2"
          onClick={() => setCollapsed()}
        >
          {!isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </Button>

        {/* ADD RESOURCE BUTTON (Indigo/Violet Accent) */}
        <Dialog>
          <DialogTrigger asChild>
            <Button
              size="icon"
              title="Add Resource"
              className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 text-white shadow-lg shadow-indigo-900/20 transition-all hover:scale-105"
            >
              <Plus size={20} strokeWidth={2.5} />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-neutral-900 border-neutral-800 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>Add Resource</span>
              </DialogTitle>
              {/* FIX: Added DialogDescription to resolve the console accessibility warning */}
              <DialogDescription className="text-neutral-400 text-sm">
                Upload a PDF, YouTube link, or audio file to generate notes and summaries.
              </DialogDescription>
            </DialogHeader>
            
            {/* UnifiedAddTool is the component that handles the actual "addReference" logic.
                When it finishes processing a PDF or YouTube link, it will push that 
                individual summary to the NotesContext.
            */}
            <UnifiedAddTool />
          </DialogContent>
        </Dialog>

        <div className="h-px w-8 bg-neutral-800 my-1" />

        {/* Live Meeting Tab */}
        <Button
          size="icon"
          variant="ghost"
          title="Live Meeting"
          className={clsx(
            "rounded-xl transition-all h-10 w-10",
            activeTool === "live" 
              ? "bg-neutral-800 text-green-400 shadow-inner" 
              : "text-neutral-500 hover:text-green-300 hover:bg-neutral-800"
          )}
          onClick={() => {
            if (isCollapsed) setCollapsed();
            setActiveTool("live");
          }}
        >
          <Mic size={20} />
        </Button>

        {/* Help Tab */}
        <Button
          size="icon"
          variant="ghost"
          title="Help"
          className={clsx(
            "rounded-xl transition-all h-10 w-10",
            activeTool === "help" 
              ? "bg-neutral-800 text-white shadow-inner" 
              : "text-neutral-500 hover:text-white hover:bg-neutral-800"
          )}
          onClick={() => {
            if (isCollapsed) setCollapsed();
            setActiveTool("help");
          }}
        >
          <HelpCircleIcon size={20} />
        </Button>
      </div>

      {/* Main Content Area */}
      <div className={clsx("flex-1 transition-all duration-300 overflow-y-auto px-4 py-3 bg-black/20", isCollapsed ? "hidden" : "block")}>
        {activeTool === "live" && <LiveTranscriber />}
        {activeTool === "help" && <Help />}
      </div>
    </div>
  );
}