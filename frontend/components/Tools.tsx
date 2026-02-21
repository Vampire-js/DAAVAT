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
  
  // --- STATE FOR DIALOG AND PROGRESS ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [globalProgress, setGlobalProgress] = useState<number | null>(null);

  return (
    <div className="h-full flex flex-row-reverse overflow-hidden">
      
      {/* --- VISUALLY APPEALING FLOATING PROGRESS BAR --- */}
      {globalProgress !== null && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-[9999] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-full h-7 overflow-hidden shadow-2xl shadow-orange-500/10 flex items-center relative">
            
            {/* Animated Progress Fill */}
            <div 
              className="h-full bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.5)] transition-all duration-500 ease-out relative flex items-center justify-end"
              style={{ 
                width: `${globalProgress}%`,
                transitionProperty: "width",
                // 'ease-out' makes the bar slow down as it reaches the new % point, looking more natural
                transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" 
              }}
            >
              {/* Inner Stripe Animation Effect */}
              <div 
                className="absolute inset-0 opacity-30 bg-[linear-gradient(45deg,rgba(255,255,255,0.3)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.3)_75%,transparent_75%,transparent)] bg-[length:30px_30px] animate-[progress-stripe_1.5s_linear_infinite]" 
              />
            </div>

            {/* Percentage Label - Floating inside */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black uppercase tracking-widest text-white drop-shadow-md">
                {globalProgress}% <span className="text-neutral-400 ml-1">Synthesizing Note</span>
              </span>
            </div>
          </div>
        </div>
      )}

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

        {/* --- MODIFIED DIALOG FOR RESOURCE UPLOADING --- */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              title="Add Resource"
              onClick={() => setIsDialogOpen(true)}
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
              <DialogDescription className="text-neutral-400 text-sm">
                Upload a PDF, YouTube link, or audio file to generate notes and summaries.
              </DialogDescription>
            </DialogHeader>
            
            {/* --- PASSING PROPS TO CONTROL CLOSING AND PROGRESS --- */}
            <UnifiedAddTool 
              onClose={() => setIsDialogOpen(false)} 
              setProgress={setGlobalProgress} 
            />
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