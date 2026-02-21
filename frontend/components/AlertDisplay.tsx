import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type Props = {
  alert: { message: string; type: string } | null;
  hide: () => void;
};

const colors: Record<string, string> = {
  success: "bg-green-600",
  error: "bg-red-600",
  warning: "bg-yellow-600",
  info: "bg-blue-600",
};

export default function AlertDisplay({ alert, hide }: Props) {
  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg text-white flex items-center gap-3 shadow-lg border ${colors[alert.type]}`}
        >
          <span>{alert.message}</span>
          <button onClick={hide} className="opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
