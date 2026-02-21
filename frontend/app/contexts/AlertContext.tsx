"use client";

import AlertDisplay from "@/components/AlertDisplay";
import { DialogDisplay } from "@/components/DialogDisplay";
import { createContext, useContext, useState, ReactNode } from "react";

//
// ---------- TYPES ----------
//
type AlertType = "success" | "error" | "warning" | "info";

type DialogOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
};

type UIContextType = {
  alert: { message: string; type: AlertType } | null;
  showAlert: (message: string, type?: AlertType, duration?: number) => void;
  hideAlert: () => void;

  dialog: DialogOptions | null;
  showDialog: (options: DialogOptions) => void;
  closeDialog: () => void;
};


//
// ---------- CONTEXT ----------
//
const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {

  // 🔹 ALERT STATE
  const [alert, setAlert] = useState<{ message: string; type: AlertType } | null>(null);

  const showAlert = (message: string, type: AlertType = "info", duration = 3000) => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), duration);
  };

  const hideAlert = () => setAlert(null);

  // 🔹 DIALOG STATE
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  const showDialog = (options: DialogOptions) => setDialog(options);
  const closeDialog = () => setDialog(null);

  return (
    <UIContext.Provider value={{ alert, showAlert, hideAlert, dialog, showDialog, closeDialog }}>
      {children}
      <AlertDisplay alert={alert} hide={hideAlert} />
      <DialogDisplay dialog={dialog} closeDialog={closeDialog} />
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}
