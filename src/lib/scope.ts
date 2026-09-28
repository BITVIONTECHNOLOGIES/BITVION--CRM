import type { Lead, User } from "@/types";

export function isAdmin(user: User | undefined) {
  return !user || user.role === "administrator" || user.businessUnit === "both";
}

export function deskLeads(leads: Lead[], user: User | undefined) {
  if (isAdmin(user)) return leads;
  const desk = leads.filter((lead) => lead.businessUnit === user?.businessUnit);
  if (user?.access.viewAllLeads) return desk;
  return desk.filter((lead) => lead.assignedTo === user?.id);
}
