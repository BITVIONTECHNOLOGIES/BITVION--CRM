import { SOURCE_LABEL } from "@/data/catalog";
import type { Activity, Lead } from "@/types";

export function leadTimeline(lead: Lead, activities: Activity[], actorId: string): Activity[] {
  const real = activities.filter((item) => item.leadId === lead.id);
  const synthetic: Activity[] = [];
  if (!real.some((item) => item.type === "lead_created")) {
    synthetic.push({
      id: `syn_created_${lead.id}`,
      at: lead.createdAt,
      userId: actorId,
      leadId: lead.id,
      leadName: lead.fullName,
      type: "lead_created",
      action: "Lead created",
      details: `Lead created from ${SOURCE_LABEL[lead.source]}.`,
    });
  }
  if (!real.some((item) => item.type === "assigned")) {
    synthetic.push({
      id: `syn_assigned_${lead.id}`,
      at: new Date(+new Date(lead.createdAt) + 60 * 1000).toISOString(),
      userId: actorId,
      leadId: lead.id,
      leadName: lead.fullName,
      type: "assigned",
      action: "Lead assigned",
      details: "Assigned to the recruitment desk.",
    });
  }
  return [...synthetic, ...real].sort((a, b) => +new Date(b.at) - +new Date(a.at));
}
