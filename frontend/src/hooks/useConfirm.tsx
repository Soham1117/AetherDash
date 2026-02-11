"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
}

export function useConfirm() {
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const openConfirm = useCallback(
    (
      title: string,
      description: string,
      onConfirm: () => void | Promise<void>,
      actionLabel = "Confirm",
      variant: "default" | "destructive" = "default"
    ) => {
      setConfirmConfig({
        isOpen: true,
        title,
        description,
        onConfirm,
        actionLabel,
        variant,
      });
    },
    []
  );

  const closeConfirm = useCallback(() => {
    setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const ConfirmDialog = useCallback(
    () => (
      <Dialog open={confirmConfig.isOpen} onOpenChange={(open) => !open && closeConfirm()}>
        <DialogContent className="bg-[#121212] border-white/15 text-white sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{confirmConfig.title}</DialogTitle>
            <DialogDescription className="text-white/60">
              {confirmConfig.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={closeConfirm}
              className="bg-transparent border-white/15 text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              variant={confirmConfig.variant || "default"}
              onClick={async () => {
                await confirmConfig.onConfirm();
                closeConfirm();
              }}
            >
              {confirmConfig.actionLabel || "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ),
    [confirmConfig, closeConfirm]
  );

  return { openConfirm, ConfirmDialog };
}
