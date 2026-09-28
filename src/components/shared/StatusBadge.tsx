import { Badge } from "@/components/ui/badge";
import { PRIORITY_CLASS, PRIORITY_LABEL, STATUS_CLASS, STATUS_LABEL } from "@/data/catalog";
import type { LeadStatus, Priority } from "@/types";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={PRIORITY_CLASS[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}
