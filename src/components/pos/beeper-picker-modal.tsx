"use client";

import { Button } from "@/components/ui/button";
import { beeperNumbers } from "@/lib/beeper";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface BeeperPickerModalProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  takenNumbers: number[];
  loading?: boolean;
  onSelect: (number: number) => void;
  onCancel: () => void;
}

export function BeeperPickerModal({
  open,
  title = "Beeper number",
  subtitle,
  takenNumbers,
  loading = false,
  onSelect,
  onCancel,
}: BeeperPickerModalProps) {
  if (!open) return null;

  const taken = new Set(takenNumbers);

  return (
    <div className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-sm:animate-slide-up-in sm:animate-scale-in max-h-[90dvh] w-full overflow-auto rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-lg sm:max-w-lg sm:rounded-lg sm:p-6">
        <h3 className="text-center text-lg font-semibold text-neutral-900">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-2 text-center text-sm text-neutral-500">{subtitle}</p>
        )}
        <p className="mt-2 text-center text-xs text-neutral-400">
          Numbers in use stay locked until the order is marked done.
        </p>

        {loading ? (
          <div className="mt-8 flex justify-center py-10 text-neutral-500">
            <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.5} />
          </div>
        ) : (
          <div className="mt-5 grid max-h-72 grid-cols-5 gap-2 overflow-auto sm:grid-cols-10">
            {beeperNumbers().map((number) => {
              const inUse = taken.has(number);
              return (
                <button
                  key={number}
                  type="button"
                  disabled={inUse}
                  onClick={() => onSelect(number)}
                  className={cn(
                    "flex h-11 items-center justify-center rounded-md border text-sm font-semibold transition-colors",
                    inUse
                      ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400"
                      : "border-neutral-200 text-neutral-900 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
                  )}
                  title={inUse ? "In use" : `Beeper ${number}`}
                >
                  {number}
                </button>
              );
            })}
          </div>
        )}

        <Button variant="secondary" className="mt-5 w-full" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
