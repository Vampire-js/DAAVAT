"use client";

import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { apiFetch } from "@/app/lib/api";
import { useNote } from "@/app/contexts/NotesContext";

interface GraphProps {
    setSelected: (value: "notes" | "graph") => void;
}

export function Graph({ setSelected }: GraphProps) {
    const { setSelectedDocId } = useNote();
    const containerRef = useRef<HTMLDivElement>(null);
    const [notes, setNotes] = useState<any[]>([]);

    useEffect(() => {
        apiFetch("/fileTree/documents")
            .then(res => res.json())
            .then(data => {
                const onlyNotes = data.filter(
                    (doc: any) => doc.type === "note"
                );
                setNotes(onlyNotes);
            });
    }, []);

    useEffect(() => {
        if (!containerRef.current || notes.length === 0) return;

        const elements = notes.map(note => ({
            data: {
                id: note._id,
                label: note.name,
            }
        }));

        const cy = cytoscape({
            container: containerRef.current,
            elements,
            style: [
                {
                    selector: "node",
                    style: {
                        "background-color": "#7c3aed",
                        "width": 12,
                        "height": 12,
                        "label": "data(label)",
                        "color": "#a3a3a3",
                        "font-size": 8,
                        "text-valign": "bottom",
                        "text-halign": "center",
                        "text-margin-y": 6,
                        "font-family": "Inter, sans-serif",
                    },
                },
                {
                    selector: "edge",
                    style: {
                        "width": 1,
                        "line-color": "#333",
                        "curve-style": "bezier",
                    },
                },
            ],

            layout: {
                name: "cose",
                animate: true,
                fit: true,
                padding: 150, // Increased padding
                nodeOverlap: 20,
                // Sparse settings:
                idealEdgeLength: (edge: any) => 100, // Increase edge length for more space
                nodeRepulsion: (node: any) => 1000000, // Stronger repulsion to push nodes apart
                edgeElasticity: (edge: any) => 100,
                nestingFactor: 5,
                gravity: 0.25, // Lower gravity to prevent clumping
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0,
            } as any,
        });

        cy.on("tap", "node", (event) => {
            const nodeId = event.target.id();
            setSelectedDocId(nodeId);
            setSelected("notes");
        });

        return () => {
            cy.destroy();
        };
    }, [notes, setSelectedDocId, setSelected]);

    return (
        <div className="w-full h-full bg-[#0a0a0a]">
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
}