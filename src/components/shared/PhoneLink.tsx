import { Phone } from "lucide-react";
import { cn, digits, formatPhone } from "@/lib/utils";

export function PhoneLink({ phone, className }: { phone: string; className?: string }) {
  const number = digits(phone);
  const label = formatPhone(phone);
  if (number.length < 10) return <span className={className}>{label}</span>;
  return (
    <a
      href={`tel:+${number}`}
      className={cn("inline-flex items-center gap-1 font-medium text-navy hover:underline", className)}
      onClick={(event) => event.stopPropagation()}
    >
      <Phone className="size-3.5 shrink-0" />
      {label}
    </a>
  );
}
