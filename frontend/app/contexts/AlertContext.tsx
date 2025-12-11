"use client";

import { createContext, useContext, ReactNode } from "react";

type DialogOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};

type UIContextType = {
  showAlert: (message: string) => void;
  showDialog: (opts: DialogOptions) => void;
};

const UIContext = createContext<UIContextType | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const showAlert = (message: string) => {
    // simple fallback to browser alert for now
    if (typeof window !== "undefined") {
      window.alert(message);
    }
  };

  const showDialog = (opts: DialogOptions) => {
    // very small, synchronous confirm-based dialog fallback
    if (typeof window === "undefined") return;

    const text = [opts.title, opts.message].filter(Boolean).join("\n\n");
    const ok = window.confirm(text || opts.confirmText || "Are you sure?");
    if (ok) opts.onConfirm?.();
    else opts.onCancel?.();
  };

  return <UIContext.Provider value={{ showAlert, showDialog }}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within AlertProvider");
  return ctx;
}
