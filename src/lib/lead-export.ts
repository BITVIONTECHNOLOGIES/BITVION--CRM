import { format } from "date-fns";
import { PRIORITY_LABEL, SOURCE_LABEL, STATUS_LABEL } from "@/data/catalog";
import { downloadCsv, excelPhone } from "@/lib/csv";
import { userName } from "@/lib/template";
import type { Lead, User } from "@/types";

export function exportLeadSheet(leads: Lead[], users: User[]) {
  const rows: Array<Array<string | number>> = [
    ["Full name", "Phone", "Email", "Location", "Position", "Desk", "Stage", "Priority", "Source", "Assigned", "Created"],
  ];
  for (const lead of leads) {
    rows.push([
      lead.fullName,
      excelPhone(lead.phone),
      lead.email,
      lead.location,
      lead.position,
      lead.businessUnit === "clinic" ? "Clinic" : "Institute",
      STATUS_LABEL[lead.status],
      PRIORITY_LABEL[lead.priority],
      SOURCE_LABEL[lead.source],
      lead.assignedTo ? userName(users, lead.assignedTo) : "Unassigned",
      format(new Date(lead.createdAt), "dd-MM-yyyy HH:mm"),
    ]);
  }
  downloadCsv(`bitvion-leads-${format(new Date(), "yyyy-MM-dd")}.csv`, rows);
}
