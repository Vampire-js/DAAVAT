import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DialogDisplay({ dialog, closeDialog }: any) {
  return (
    <Dialog open={!!dialog} onOpenChange={closeDialog}>
      <DialogContent className="bg-neutral-900 text-white">
        <DialogHeader>
          <DialogTitle>{dialog?.title ?? "Confirm"}</DialogTitle>
        </DialogHeader>

        <p className="text-neutral-400">{dialog?.message}</p>

        <DialogFooter>
          <Button variant="secondary" onClick={closeDialog}>
            {dialog?.cancelText ?? "Cancel"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              dialog?.onConfirm?.();
              closeDialog();
            }}
          >
            {dialog?.confirmText ?? "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
