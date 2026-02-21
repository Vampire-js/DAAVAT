"use client"
import { GitGraphIcon, NotebookIcon } from "lucide-react";
import { Button } from "./ui/button";


interface SidebarProps {
    selected: "notes" | "graph";
    setSelected: (value: "notes" | "graph") => void;
}

export default function SideBar({ selected, setSelected }: SidebarProps) {
    return (
        <div className="w-18 border-r border-border flex flex-col items-center py-4 gap-4 bg-background/50">
            <img src="/Logo.svg" className="w-6" alt="Logo" />

            <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected("notes")}
                className={
                    selected === "notes"
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                }
            >
                <NotebookIcon />
            </Button>

            <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected("graph")}
                className={
                    selected === "graph"
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                }
            >
                <GitGraphIcon />
            </Button>
        </div>
    );
}