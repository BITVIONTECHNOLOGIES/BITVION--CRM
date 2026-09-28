import { addMonths, format, startOfMonth } from "date-fns";
import { SOURCE_LABEL, STATUS_LABEL, STATUS_ORDER } from "@/data/catalog";
import { dayLabels, followUpBucket, inRange, monthKey, sameSlot } from "@/lib/dates";
import type { CrmState, DateRangeKey, Lead, LeadSource, LeadStatus } from "@/types";

export interface SnapshotMetrics {
  total: number;
  newLeads: number;
  interested: number;
  pendingFollowUps: number;
  documentsPending: number;
  converted: number;
  conversionRate: number;
  overdue: number;
}

export function countStatus(leads: Lead[], status: LeadStatus) {
  return leads.filter((lead) => lead.status === status).length;
}

export function snapshotMetrics(state: CrmState, now = new Date()): SnapshotMetrics {
  const total = state.leads.length;
  const converted = countStatus(state.leads, "converted");
  const pendingFollowUps = state.followUps.filter(
    (item) => followUpBucket(item.dueAt, item.status, now) === "today" || followUpBucket(item.dueAt, item.status, now) === "upcoming",
  ).length;
  const overdue = state.followUps.filter((item) => followUpBucket(item.dueAt, item.status, now) === "overdue").length;

  return {
    total,
    newLeads: countStatus(state.leads, "new"),
    interested: countStatus(state.leads, "interested"),
    pendingFollowUps,
    documentsPending: countStatus(state.leads, "documents_pending"),
    converted,
    conversionRate: total ? (converted / total) * 100 : 0,
    overdue,
  };
}

export function periodSummary(state: CrmState, range: DateRangeKey, now = new Date()) {
  const leads = state.leads.filter((lead) => inRange(lead.createdAt, range, now));
  const converted = state.leads.filter((lead) => inRange(lead.convertedAt, range, now)).length;
  const followUps = state.followUps.filter((item) => inRange(item.dueAt, range, now));
  const completed = followUps.filter((item) => item.status === "completed").length;
  return {
    added: leads.length,
    converted,
    followUps: followUps.length,
    completed,
  };
}

export function acquisitionSeries(leads: Lead[], range: DateRangeKey, now = new Date()) {
  return dayLabels(range, now).map((slot) => ({
    label: slot.label,
    leads: leads.filter((lead) => sameSlot(lead.createdAt, slot.date, range)).length,
  }));
}

export function pipelineSeries(leads: Lead[], range: DateRangeKey, now = new Date()) {
  const scoped = leads.filter((lead) => inRange(lead.createdAt, range, now));
  return STATUS_ORDER.map((status) => ({
    name: STATUS_LABEL[status],
    value: scoped.filter((lead) => lead.status === status).length,
  }));
}

export function sourceSeries(leads: Lead[], range: DateRangeKey, now = new Date()) {
  const scoped = leads.filter((lead) => inRange(lead.createdAt, range, now));
  const sources = Object.keys(SOURCE_LABEL) as LeadSource[];
  return sources
    .filter((source) => source !== "other")
    .map((source) => ({
      name: SOURCE_LABEL[source],
      value: scoped.filter((lead) => lead.source === source).length,
    }));
}

export function followUpSeries(state: CrmState, range: DateRangeKey, now = new Date()) {
  const scoped = state.followUps.filter((item) => inRange(item.dueAt, range, now));
  const completed = scoped.filter((item) => item.status === "completed").length;
  const overdue = scoped.filter((item) => followUpBucket(item.dueAt, item.status, now) === "overdue").length;
  const pending = scoped.length - completed - overdue;
  return [
    { name: "Completed", value: completed },
    { name: "Pending", value: Math.max(pending, 0) },
    { name: "Overdue", value: overdue },
  ];
}

export function conversionSeries(leads: Lead[], range: DateRangeKey, now = new Date()) {
  if (range === "month") {
    return Array.from({ length: 6 }, (_, index) => {
      const month = startOfMonth(addMonths(now, index - 5));
      const key = format(month, "MMM yy");
      return {
        label: format(month, "MMM"),
        converted: leads.filter((lead) => lead.convertedAt && monthKey(lead.convertedAt) === key).length,
      };
    });
  }

  return dayLabels(range, now).map((slot) => ({
    label: slot.label,
    converted: leads.filter((lead) => lead.convertedAt && sameSlot(lead.convertedAt, slot.date, range)).length,
  }));
}

export function employeeRows(state: CrmState, range: DateRangeKey | "all", now = new Date()) {
  return state.users.map((user) => {
    const leads = state.leads.filter((lead) => {
      if (lead.assignedTo !== user.id) return false;
      if (range === "all") return true;
      return inRange(lead.createdAt, range, now);
    });
    const contacted = leads.filter((lead) => lead.status !== "new").length;
    const interested = leads.filter((lead) => lead.status === "interested").length;
    const converted = leads.filter((lead) => lead.status === "converted").length;
    const lost = leads.filter((lead) => lead.status === "lost").length;
    const followUps = state.followUps.filter((item) => item.assignedTo === user.id && item.status === "completed");
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      leads: leads.length,
      contacted,
      interested,
      converted,
      lost,
      followUps: followUps.length,
      rate: leads.length ? (converted / leads.length) * 100 : 0,
    };
  });
}

export function averageResponseMinutes(state: CrmState) {
  const deltas: number[] = [];
  for (const conversation of state.conversations) {
    const messages = state.messages
      .filter((message) => message.conversationId === conversation.id)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    for (let index = 0; index < messages.length; index += 1) {
      const current = messages[index];
      if (!current || current.direction !== "out") continue;
      const reply = messages.slice(index + 1).find((message) => message.direction === "in");
      if (!reply) continue;
      deltas.push((+new Date(reply.createdAt) - +new Date(current.createdAt)) / 60000);
    }
  }
  if (!deltas.length) return null;
  return deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
}

export function formatDuration(minutes: number | null) {
  if (minutes == null) return "—";
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}
