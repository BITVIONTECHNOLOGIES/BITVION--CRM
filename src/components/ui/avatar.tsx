import { avatarColor, initials } from "@/lib/utils";

export function Avatar({ name, className = "size-8 text-xs" }: { name: string; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white ${className}`}
      style={{ background: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}
