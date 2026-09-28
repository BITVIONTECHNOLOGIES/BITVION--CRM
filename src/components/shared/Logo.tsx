import { cn } from "@/lib/utils";

export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  return (
    <img
      src={mark ? "/logo-mark.png" : "/logo.png"}
      alt="BITVION Technologies"
      className={cn("object-contain", className)}
    />
  );
}
