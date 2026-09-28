import { format } from "date-fns";
import type { AppSettings, Lead, User } from "@/types";
import { firstName } from "@/lib/utils";

export function renderTemplate(
  body: string,
  lead: Pick<Lead, "fullName" | "position" | "nextFollowUpAt">,
  settings: Pick<AppSettings, "companyName">,
  agentName: string,
) {
  const when = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : new Date();
  const values: Record<string, string> = {
    name: firstName(lead.fullName),
    position: lead.position,
    company: settings.companyName,
    date: format(when, "d MMM yyyy"),
    time: lead.nextFollowUpAt ? format(when, "h:mm a") : "10:00 AM",
    assigned_agent: agentName,
  };

  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
}

export function userName(users: Array<Pick<User, "id" | "name">>, id: string) {
  return users.find((user) => user.id === id)?.name ?? "Unassigned";
}
