"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

interface TabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {}
interface TabsListProps extends React.ComponentProps<typeof TabsPrimitive.List> {}
interface TabsTriggerProps extends React.ComponentProps<typeof TabsPrimitive.Trigger> {
  closable?: boolean;
  onClose?: () => void;
}
interface TabsContentProps extends React.ComponentProps<typeof TabsPrimitive.Content> {}

function Tabs({ className, ...props }: TabsProps) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2 w-full h-full", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-start rounded-lg p-[3px] gap-1 overflow-x-auto",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, closable, onClose, children, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="flex items-center gap-1">
        {children}
        {closable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="ml-1 text-red-400 hover:text-red-600 text-xs font-bold"
          >
            ×
          </button>
        )}
      </span>
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none w-full h-full", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
