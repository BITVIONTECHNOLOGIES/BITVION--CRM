import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useCrm } from "@/context/CrmContext";

export function HowItWorks({ page }: { page: "home" | "leads" | "follow" | "calls" | "team" | "desk" }) {
  const { session } = useAuth();
  const { state } = useCrm();
  const me = state.users.find((user) => user.id === session?.userId);
  const admin = me?.access.manageTeam ?? me?.role === "administrator";

  const copy = admin
    ? {
        home: "Admin home is the two desks side by side. Clinic and institute logins do not see this screen.",
        leads: "Filter by status, date, source or person. Fresh Meta leads have no counsellor until you assign them on Team.",
        follow: "Clinic follow-ups can send WhatsApp automatically. Institute follow-ups stay as a direct call or a single WhatsApp.",
        calls: "Every Call button saves the minutes. Filter by employee, lead status and date to see who spoke, and for how long.",
        team: "RBAC is here. Add an employee, pick Clinic or Institute, then tick what they can open. Counsellors only see their own leads.",
        desk: "Pick an employee to see only their book: name, phone, place, and how many times they have called.",
      }
    : {
        home: me?.businessUnit === "institute"
          ? "Institute home: your assigned leads, filters, and call time for each day. WhatsApp does not send itself."
          : "Clinic home: your assigned leads, filters, call time for each day, and the WhatsApp welcome demo.",
        leads: "Search your own leads. Status and date filters stay on this list. You cannot see other counsellors' books.",
        follow: "These are your follow-ups. Complete, reschedule, call, or send one WhatsApp. Institute leads are never sent automatically.",
        calls: "Your calls only. The minutes you log are what the admin sees in the total.",
        team: "Team access is managed by the admin.",
        desk: "This is your book. Name, phone and place are on each row. Call or WhatsApp from here.",
      };

  return (
    <Card className="px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">HOW THIS LOGIN WORKS</p>
      <p className="mt-1 text-sm">{copy[page]}</p>
    </Card>
  );
}
