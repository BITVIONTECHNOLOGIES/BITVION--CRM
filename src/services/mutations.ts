import { format } from "date-fns";
import { STATUS_LABEL } from "@/data/catalog";
import { followUpBucket, tomorrowAt10 } from "@/lib/dates";
import { digits, firstName, uid } from "@/lib/utils";
import { renderTemplate, userName } from "@/lib/template";
import type {
  Activity,
  Campaign,
  CrmState,
  FollowUp,
  FollowUpType,
  Lead,
  LeadInput,
  LeadStatus,
  Task,
  TaskStatus,
  Template,
  User,
  WhatsAppMessage,
} from "@/types";

export interface MutationResult<T> {
  state: CrmState;
  result: T;
  error?: string;
}

function activity(input: Omit<Activity, "id" | "at"> & { at?: string }): Activity {
  return {
    id: uid("act"),
    at: input.at ?? new Date().toISOString(),
    userId: input.userId,
    leadId: input.leadId,
    leadName: input.leadName,
    type: input.type,
    action: input.action,
    details: input.details,
  };
}

function withActivity(state: CrmState, item: Activity): CrmState {
  return refreshSystem({ ...state, activities: [item, ...state.activities] });
}

function syncNextFollowUp(state: CrmState, leadId: string): CrmState {
  const pending = state.followUps
    .filter((item) => item.leadId === leadId && item.status === "pending")
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  return {
    ...state,
    leads: state.leads.map((lead) =>
      lead.id === leadId ? { ...lead, nextFollowUpAt: pending[0]?.dueAt ?? null, updatedAt: new Date().toISOString() } : lead,
    ),
  };
}

export function refreshSystem(state: CrmState, now = new Date()): CrmState {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const dueToday = state.followUps.filter((item) => followUpBucket(item.dueAt, item.status, now) === "today").length;
  const uncontacted = state.leads.filter((lead) => !lead.lastContactAt).length;
  const overdueDocs = state.followUps.filter(
    (item) => followUpBucket(item.dueAt, item.status, now) === "overdue" && item.type === "document_reminder",
  ).length;
  const specs = [
    state.settings.notifications.followUps
      ? { id: "sys_due_today", title: "Follow-ups due", body: `${dueToday} follow-ups are due today.`, href: "/follow-ups" }
      : null,
    { id: "sys_uncontacted", title: "Leads not contacted", body: `${uncontacted} leads have not been contacted.`, href: "/leads?contact=none" },
    state.settings.notifications.overdue
      ? { id: "sys_overdue_docs", title: "Document reminders", body: `${overdueDocs} document reminders are overdue.`, href: "/follow-ups" }
      : null,
  ].filter((item): item is { id: string; title: string; body: string; href: string } => Boolean(item));

  const kept = state.notifications.filter((item) => !item.id.startsWith("sys_") || specs.some((spec) => spec.id === item.id));
  const notifications = specs.map((spec) => {
    const existing = kept.find((item) => item.id === spec.id);
    return existing ? { ...existing, ...spec } : { ...spec, read: false, createdAt: now.toISOString() };
  });
  const rest = kept.filter((item) => !item.id.startsWith("sys_"));
  return { ...state, notifications: [...notifications, ...rest] };
}

function blankDocuments(leadId: string): Lead["documents"] {
  return ["Passport", "Photograph", "Educational Certificates", "Experience Letter"].map((name, index) => ({
    id: `${leadId}_doc_${index}`,
    name,
    status: "pending" as const,
  }));
}

export function findDuplicate(state: CrmState, input: { phone: string; whatsapp: string; email: string }, ignoreId?: string) {
  const phones = new Set([digits(input.phone), digits(input.whatsapp)].filter(Boolean));
  const email = input.email.trim().toLowerCase();
  return state.leads.find((lead) => {
    if (lead.id === ignoreId) return false;
    const leadPhones = [digits(lead.phone), digits(lead.whatsapp)];
    return lead.email.toLowerCase() === email || leadPhones.some((phone) => phones.has(phone));
  });
}

export function addLead(state: CrmState, input: LeadInput, actorId: string): MutationResult<Lead | null> {
  const duplicate = findDuplicate(state, input);
  if (duplicate) {
    return { state, result: null, error: "A lead with this phone or email already exists." };
  }
  const now = new Date().toISOString();
  const businessUnit = input.businessUnit ?? (input.jobCategory === "Institute" ? "institute" : "clinic");
  const lead: Lead = {
    ...input,
    businessUnit,
    metaCampaignId: input.metaCampaignId ?? "",
    metaCampaignName: input.metaCampaignName ?? "",
    whatsappAutomation: businessUnit === "clinic",
    callCount: 0,
    talkSeconds: 0,
    id: uid("ld"),
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    documents: blankDocuments(uid("doc")),
    noteEntries: input.notes.trim()
      ? [{ id: uid("note"), body: input.notes.trim(), userId: actorId, createdAt: now }]
      : [],
    createdAt: now,
    updatedAt: now,
    lastContactAt: null,
    nextFollowUpAt: null,
    convertedAt: input.status === "converted" ? now : null,
  };
  let next = withActivity(
    { ...state, leads: [lead, ...state.leads] },
    activity({
      userId: actorId,
      leadId: lead.id,
      leadName: lead.fullName,
      type: "lead_created",
      action: "Lead created",
      details: `Lead created from ${input.source.replace(/_/g, " ")}.`,
    }),
  );
  next = withActivity(
    next,
    activity({
      userId: actorId,
      leadId: lead.id,
      leadName: lead.fullName,
      type: "assigned",
      action: "Lead assigned",
      details: `Assigned to ${userName(state.users, input.assignedTo)}.`,
    }),
  );

  if (state.automation.enabled && state.automation.runOnNewLeads && lead.whatsappAutomation) {
    const template = state.templates.find((item) => item.key === "WELCOME_MESSAGE");
    if (template) {
      const sent = sendWhatsApp(next, { leadId: lead.id, body: renderTemplate(template.body, lead, state.settings, userName(state.users, lead.assignedTo)), templateId: template.id, actorId });
      return { state: sent.state, result: sent.state.leads.find((item) => item.id === lead.id) ?? lead };
    }
  }

  return { state: next, result: lead };
}

export function updateLead(state: CrmState, id: string, input: LeadInput, actorId: string): MutationResult<Lead | null> {
  const current = state.leads.find((lead) => lead.id === id);
  if (!current) return { state, result: null, error: "Lead not found." };
  if (findDuplicate(state, input, id)) {
    return { state, result: null, error: "A lead with this phone or email already exists." };
  }
  const now = new Date().toISOString();
  const businessUnit = input.businessUnit ?? current.businessUnit;
  const updated: Lead = {
    ...current,
    ...input,
    businessUnit,
    whatsappAutomation: businessUnit === "clinic",
    metaCampaignId: input.metaCampaignId || current.metaCampaignId,
    metaCampaignName: input.metaCampaignName || current.metaCampaignName,
    callCount: current.callCount,
    talkSeconds: current.talkSeconds,
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    updatedAt: now,
    convertedAt: input.status === "converted" ? current.convertedAt ?? now : input.status === current.status ? current.convertedAt : null,
  };
  let next: CrmState = { ...state, leads: state.leads.map((lead) => (lead.id === id ? updated : lead)) };
  if (current.status !== input.status) {
    next = withActivity(
      next,
      activity({
        userId: actorId,
        leadId: id,
        leadName: updated.fullName,
        type: input.status === "converted" ? "converted" : "status_changed",
        action: input.status === "converted" ? "Candidate converted" : "Status changed",
        details: `Status changed: ${STATUS_LABEL[current.status]} → ${STATUS_LABEL[input.status]}.`,
      }),
    );
  }
  if (current.assignedTo !== input.assignedTo) {
    next = withActivity(
      next,
      activity({
        userId: actorId,
        leadId: id,
        leadName: updated.fullName,
        type: "assigned",
        action: "Lead assigned",
        details: `Assigned to ${userName(state.users, input.assignedTo)}.`,
      }),
    );
  }
  return { state: next, result: updated };
}

export function setLeadStatus(state: CrmState, id: string, status: LeadStatus, actorId: string): MutationResult<Lead | null> {
  const current = state.leads.find((lead) => lead.id === id);
  if (!current) return { state, result: null, error: "Lead not found." };
  if (current.status === status) return { state, result: current };
  return updateLead(state, id, leadToInput({ ...current, status }), actorId);
}

export function deleteLeads(state: CrmState, ids: string[], actorId: string): CrmState {
  const idSet = new Set(ids);
  const removed = state.leads.filter((lead) => idSet.has(lead.id));
  const conversationIds = new Set(state.conversations.filter((item) => idSet.has(item.leadId)).map((item) => item.id));
  let next: CrmState = {
    ...state,
    leads: state.leads.filter((lead) => !idSet.has(lead.id)),
    followUps: state.followUps.filter((item) => !idSet.has(item.leadId)),
    tasks: state.tasks.map((task) => (task.leadId && idSet.has(task.leadId) ? { ...task, leadId: null } : task)),
    conversations: state.conversations.filter((item) => !idSet.has(item.leadId)),
    messages: state.messages.filter((item) => !conversationIds.has(item.conversationId)),
  };
  removed.slice(0, 12).forEach((lead) => {
    next = withActivity(
      next,
      activity({
        userId: actorId,
        leadId: null,
        leadName: lead.fullName,
        type: "deleted",
        action: "Lead deleted",
        details: `${lead.fullName} was removed from the pipeline.`,
      }),
    );
  });
  return next;
}

export function bulkAssign(state: CrmState, ids: string[], userId: string, actorId: string) {
  let next = state;
  ids.forEach((id) => {
    const lead = next.leads.find((item) => item.id === id);
    if (!lead) return;
    next = updateLead(next, id, leadToInput({ ...lead, assignedTo: userId }), actorId).state;
  });
  return next;
}

export function bulkStatus(state: CrmState, ids: string[], status: LeadStatus, actorId: string) {
  let next = state;
  ids.forEach((id) => {
    next = setLeadStatus(next, id, status, actorId).state;
  });
  return next;
}

export function bulkTag(state: CrmState, ids: string[], tag: string) {
  const clean = tag.trim();
  if (!clean) return state;
  return {
    ...state,
    leads: state.leads.map((lead) => (ids.includes(lead.id) && !lead.tags.includes(clean) ? { ...lead, tags: [...lead.tags, clean] } : lead)),
  };
}

export function addFollowUp(
  state: CrmState,
  input: { leadId: string; type: FollowUpType; dueAt: string; notes: string; assignedTo?: string },
  actorId: string,
): MutationResult<FollowUp | null> {
  const lead = state.leads.find((item) => item.id === input.leadId);
  if (!lead) return { state, result: null, error: "Lead not found." };
  const followUp: FollowUp = {
    id: uid("fu"),
    leadId: lead.id,
    assignedTo: input.assignedTo || lead.assignedTo,
    type: input.type,
    dueAt: input.dueAt,
    status: "pending",
    notes: input.notes.trim(),
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  const next = withActivity(syncNextFollowUp({ ...state, followUps: [followUp, ...state.followUps] }, lead.id), activity({
    userId: actorId,
    leadId: lead.id,
    leadName: lead.fullName,
    type: "follow_up",
    action: "Follow-up scheduled",
    details: `Follow-up scheduled for ${format(new Date(input.dueAt), "d MMM yyyy 'at' h:mm a")}.`,
  }));
  return { state: next, result: followUp };
}

export function completeFollowUp(state: CrmState, id: string, actorId: string): CrmState {
  const item = state.followUps.find((followUp) => followUp.id === id);
  if (!item || item.status === "completed") return state;
  const lead = state.leads.find((entry) => entry.id === item.leadId);
  const now = new Date().toISOString();
  const next = syncNextFollowUp(
    {
      ...state,
      followUps: state.followUps.map((followUp) => (followUp.id === id ? { ...followUp, status: "completed", completedAt: now } : followUp)),
    },
    item.leadId,
  );
  return withActivity(
    next,
    activity({
      userId: actorId,
      leadId: item.leadId,
      leadName: lead?.fullName ?? null,
      type: "follow_up",
      action: "Follow-up completed",
      details: item.notes || "Follow-up marked complete.",
    }),
  );
}

export function rescheduleFollowUp(state: CrmState, id: string, dueAt: string, actorId: string): CrmState {
  const item = state.followUps.find((followUp) => followUp.id === id);
  if (!item) return state;
  const lead = state.leads.find((entry) => entry.id === item.leadId);
  const next = syncNextFollowUp(
    { ...state, followUps: state.followUps.map((followUp) => (followUp.id === id ? { ...followUp, dueAt, status: "pending", completedAt: null } : followUp)) },
    item.leadId,
  );
  return withActivity(
    next,
    activity({
      userId: actorId,
      leadId: item.leadId,
      leadName: lead?.fullName ?? null,
      type: "follow_up",
      action: "Follow-up rescheduled",
      details: `Rescheduled to ${new Date(dueAt).toLocaleString()}.`,
    }),
  );
}

export function sendWhatsApp(
  state: CrmState,
  input: { leadId: string; body: string; templateId?: string | null; actorId: string; fail?: boolean },
): MutationResult<WhatsAppMessage | null> {
  const lead = state.leads.find((item) => item.id === input.leadId);
  const body = input.body.trim();
  if (!lead) return { state, result: null, error: "Lead not found." };
  if (!body) return { state, result: null, error: "Message cannot be empty." };
  if (digits(lead.whatsapp || lead.phone).length < 10) return { state, result: null, error: "Invalid phone number for WhatsApp." };

  const now = new Date().toISOString();
  let conversation = state.conversations.find((item) => item.leadId === lead.id);
  let conversations = state.conversations;
  if (!conversation) {
    conversation = { id: uid("conv"), leadId: lead.id, unread: 0, updatedAt: now };
    conversations = [conversation, ...state.conversations];
  } else {
    conversations = state.conversations.map((item) => (item.id === conversation?.id ? { ...item, updatedAt: now } : item));
  }

  const template = state.templates.find((item) => item.id === input.templateId);
  const message: WhatsAppMessage = {
    id: uid("msg"),
    conversationId: conversation.id,
    leadId: lead.id,
    direction: "out",
    body,
    status: input.fail ? "failed" : "sent",
    templateId: template?.id ?? null,
    createdAt: now,
  };

  let next: CrmState = {
    ...state,
    conversations,
    messages: [...state.messages, message],
    leads: state.leads.map((item) =>
      item.id === lead.id ? { ...item, lastContactAt: input.fail ? item.lastContactAt : now, updatedAt: now } : item,
    ),
  };

  if (input.fail) {
    next = withActivity(
      next,
      activity({
        userId: input.actorId,
        leadId: lead.id,
        leadName: lead.fullName,
        type: "whatsapp",
        action: "WhatsApp failed",
        details: "Simulated message failed. No WhatsApp API call was made.",
      }),
    );
    return { state: next, result: message, error: "Failed simulated message. Demo Mode did not send it." };
  }

  const isWelcome = template?.key === "WELCOME_MESSAGE";
  next = withActivity(
    next,
    activity({
      userId: input.actorId,
      leadId: lead.id,
      leadName: lead.fullName,
      type: "whatsapp",
      action: "WhatsApp message sent",
      details: isWelcome ? "WhatsApp welcome message sent." : `WhatsApp message sent${template ? `: ${template.name}` : ""}.`,
    }),
  );

  if (isWelcome && lead.whatsappAutomation) {
    const already = next.followUps.some((item) => item.leadId === lead.id && item.status === "pending" && item.notes.includes("welcome message"));
    if (!already) {
      const dueAt = tomorrowAt10();
      next = addFollowUp(
        next,
        {
          leadId: lead.id,
          type: "whatsapp",
          dueAt,
          notes: "Scheduled after welcome message",
          assignedTo: lead.assignedTo,
        },
        input.actorId,
      ).state;
    }
  }

  return { state: next, result: message };
}

export function simulateReply(state: CrmState, leadId: string, body: string, actorId: string): MutationResult<WhatsAppMessage | null> {
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return { state, result: null, error: "Lead not found." };
  const text = body.trim() || "Yes, I would like to continue. Please let me know the next steps.";
  const now = new Date().toISOString();
  let conversation = state.conversations.find((item) => item.leadId === lead.id);
  let conversations = state.conversations;
  if (!conversation) {
    conversation = { id: uid("conv"), leadId: lead.id, unread: 0, updatedAt: now };
    conversations = [conversation, ...conversations];
  }
  const message: WhatsAppMessage = {
    id: uid("msg"),
    conversationId: conversation.id,
    leadId: lead.id,
    direction: "in",
    body: text,
    status: "read",
    templateId: null,
    createdAt: now,
  };
  conversations = conversations.map((item) =>
    item.id === conversation?.id ? { ...item, unread: item.unread + 1, updatedAt: now } : item,
  );
  let next: CrmState = {
    ...state,
    conversations,
    messages: [...state.messages, message],
    leads: state.leads.map((item) => (item.id === lead.id ? { ...item, lastContactAt: now, updatedAt: now } : item)),
  };
  next = withActivity(
    next,
    activity({
      userId: actorId,
      leadId: lead.id,
      leadName: lead.fullName,
      type: "whatsapp",
      action: "Candidate replied",
      details: "Candidate replied.",
    }),
  );
  if (state.settings.notifications.replies) {
    next = {
      ...next,
      notifications: [
        {
          id: uid("ntf"),
          title: "WhatsApp reply",
          body: `${firstName(lead.fullName)} replied on WhatsApp.`,
          href: `/whatsapp?lead=${lead.id}`,
          read: false,
          createdAt: now,
        },
        ...next.notifications,
      ],
    };
  }
  return { state: next, result: message };
}

export function markConversationRead(state: CrmState, leadId: string) {
  return {
    ...state,
    conversations: state.conversations.map((item) => (item.leadId === leadId ? { ...item, unread: 0 } : item)),
  };
}

export function addTask(
  state: CrmState,
  input: Omit<Task, "id" | "createdAt">,
  actorId: string,
): MutationResult<Task> {
  const task: Task = { ...input, id: uid("task"), createdAt: new Date().toISOString() };
  const lead = state.leads.find((item) => item.id === task.leadId);
  const next = withActivity(
    { ...state, tasks: [task, ...state.tasks] },
    activity({
      userId: actorId,
      leadId: task.leadId,
      leadName: lead?.fullName ?? null,
      type: "task",
      action: "Task created",
      details: task.title,
    }),
  );
  return { state: next, result: task };
}

export function updateTask(state: CrmState, id: string, patch: Partial<Task>, actorId: string) {
  const current = state.tasks.find((task) => task.id === id);
  if (!current) return state;
  const updated = { ...current, ...patch, id: current.id };
  let next: CrmState = { ...state, tasks: state.tasks.map((task) => (task.id === id ? updated : task)) };
  if (current.status !== updated.status && updated.status === "completed") {
    const lead = state.leads.find((item) => item.id === updated.leadId);
    next = withActivity(
      next,
      activity({
        userId: actorId,
        leadId: updated.leadId,
        leadName: lead?.fullName ?? null,
        type: "task",
        action: "Task completed",
        details: updated.title,
      }),
    );
  }
  return next;
}

export function deleteTask(state: CrmState, id: string) {
  return { ...state, tasks: state.tasks.filter((task) => task.id !== id) };
}

export function saveTemplate(state: CrmState, input: { id?: string; name: string; key: string; body: string }): MutationResult<Template | null> {
  if (!input.name.trim() || !input.body.trim()) return { state, result: null, error: "Template name and message are required." };
  const now = new Date().toISOString();
  if (input.id) {
    const template = state.templates.find((item) => item.id === input.id);
    if (!template) return { state, result: null, error: "Template not found." };
    const updated = { ...template, name: input.name.trim(), key: input.key.trim() || template.key, body: input.body, updatedAt: now };
    return { state: { ...state, templates: state.templates.map((item) => (item.id === input.id ? updated : item)) }, result: updated };
  }
  const key = (input.key.trim() || input.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")).replace(/^_|_$/g, "");
  if (state.templates.some((item) => item.key === key)) return { state, result: null, error: "A template with this key already exists." };
  const template: Template = { id: uid("tpl"), name: input.name.trim(), key, body: input.body, createdAt: now, updatedAt: now };
  return { state: { ...state, templates: [template, ...state.templates] }, result: template };
}

export function duplicateTemplate(state: CrmState, id: string): MutationResult<Template | null> {
  const template = state.templates.find((item) => item.id === id);
  if (!template) return { state, result: null, error: "Template not found." };
  return saveTemplate(state, { name: `${template.name} copy`, key: `${template.key}_COPY`, body: template.body });
}

export function deleteTemplate(state: CrmState, id: string) {
  return { ...state, templates: state.templates.filter((item) => item.id !== id) };
}

export function audienceLeads(state: CrmState, audience: Campaign["audience"], customIds: string[] = []) {
  if (audience === "custom") return state.leads.filter((lead) => customIds.includes(lead.id));
  if (audience === "all") return state.leads;
  if (audience === "new") return state.leads.filter((lead) => lead.status === "new");
  if (audience === "interested") return state.leads.filter((lead) => lead.status === "interested");
  if (audience === "documents_pending") return state.leads.filter((lead) => lead.status === "documents_pending");
  const pendingIds = new Set(
    state.followUps.filter((item) => followUpBucket(item.dueAt, item.status) !== "completed").map((item) => item.leadId),
  );
  return state.leads.filter((lead) => pendingIds.has(lead.id));
}

export function addCampaign(
  state: CrmState,
  input: Omit<Campaign, "id" | "createdAt" | "successful" | "pending" | "failed" | "status" | "recipients"> & { status?: Campaign["status"] },
  actorId: string,
): MutationResult<Campaign> {
  const recipients = input.leadIds.length;
  const campaign: Campaign = {
    ...input,
    id: uid("cmp"),
    createdAt: new Date().toISOString(),
    recipients,
    successful: 0,
    pending: input.schedule === "later" ? recipients : recipients,
    failed: 0,
    status: input.status ?? (input.schedule === "later" ? "scheduled" : "sending"),
  };
  const next = withActivity(
    { ...state, campaigns: [campaign, ...state.campaigns] },
    activity({
      userId: actorId,
      leadId: null,
      leadName: null,
      type: "campaign",
      action: "Campaign created",
      details: `${campaign.name} created for ${recipients} recipients. Demo Mode — messages are not sent via WhatsApp.`,
    }),
  );
  return { state: next, result: campaign };
}

export function progressCampaign(state: CrmState, id: string, patch: Partial<Pick<Campaign, "successful" | "pending" | "failed" | "status">>) {
  return { ...state, campaigns: state.campaigns.map((campaign) => (campaign.id === id ? { ...campaign, ...patch } : campaign)) };
}

export function finishCampaign(state: CrmState, id: string, actorId: string, deliveredLeadIds: string[], templateBody: string) {
  const campaign = state.campaigns.find((item) => item.id === id);
  if (!campaign) return state;
  const now = new Date().toISOString();
  let next: CrmState = {
    ...state,
    campaigns: state.campaigns.map((item) =>
      item.id === id
        ? { ...item, status: "completed", pending: 0, successful: Math.max(item.recipients - item.failed, 0) }
        : item,
    ),
  };
  const template = state.templates.find((item) => item.id === campaign.templateId);
  deliveredLeadIds.slice(0, 25).forEach((leadId) => {
    const lead = next.leads.find((item) => item.id === leadId);
    if (!lead) return;
    const sent = sendWhatsApp(next, {
      leadId,
      actorId,
      templateId: template?.id,
      body: renderTemplate(templateBody, lead, state.settings, userName(state.users, lead.assignedTo)),
    });
    next = sent.state;
  });
  next = withActivity(
    next,
    activity({
      at: now,
      userId: actorId,
      leadId: null,
      leadName: null,
      type: "campaign",
      action: "Campaign completed",
      details: `${campaign.name} finished in demo mode. ${campaign.recipients - campaign.failed} simulated deliveries.`,
    }),
  );
  if (state.settings.notifications.campaigns) {
    next = {
      ...next,
      notifications: [
        {
          id: uid("ntf"),
          title: "Campaign completed",
          body: `${campaign.name} completed.`,
          href: "/campaigns",
          read: false,
          createdAt: now,
        },
        ...next.notifications,
      ],
    };
  }
  return next;
}

export function importLeads(state: CrmState, inputs: LeadInput[], actorId: string) {
  const phones = new Set<string>();
  const emails = new Set<string>();
  for (const lead of state.leads) {
    const phone = digits(lead.phone);
    const whatsapp = digits(lead.whatsapp);
    if (phone) phones.add(phone);
    if (whatsapp) phones.add(whatsapp);
    const email = lead.email.trim().toLowerCase();
    if (email) emails.add(email);
  }

  const now = new Date().toISOString();
  const created: Lead[] = [];
  const duplicates: string[] = [];
  for (const input of inputs) {
    const phone = digits(input.phone);
    const whatsapp = digits(input.whatsapp);
    const email = input.email.trim().toLowerCase();
    if ((phone && phones.has(phone)) || (whatsapp && phones.has(whatsapp)) || (email && emails.has(email))) {
      duplicates.push(input.fullName);
      continue;
    }
    if (phone) phones.add(phone);
    if (whatsapp) phones.add(whatsapp);
    if (email) emails.add(email);
    const businessUnit = input.businessUnit ?? (input.jobCategory === "Institute" ? "institute" : "clinic");
    created.push({
      ...input,
      businessUnit,
      metaCampaignId: input.metaCampaignId ?? "",
      metaCampaignName: input.metaCampaignName ?? "",
      whatsappAutomation: businessUnit === "clinic",
      callCount: 0,
      talkSeconds: 0,
      id: uid("ld"),
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      documents: blankDocuments(uid("doc")),
      noteEntries: input.notes.trim()
        ? [{ id: uid("note"), body: input.notes.trim(), userId: actorId, createdAt: now }]
        : [],
      createdAt: now,
      updatedAt: now,
      lastContactAt: null,
      nextFollowUpAt: null,
      convertedAt: input.status === "converted" ? now : null,
    });
  }

  if (!created.length) return { state, created, duplicates };
  const next = withActivity(
    { ...state, leads: [...created, ...state.leads] },
    activity({
      userId: actorId,
      leadId: null,
      leadName: null,
      type: "imported",
      action: "Leads imported",
      details: `Imported ${created.length} leads. Stages were kept, including Converted.`,
    }),
  );
  return { state: next, created, duplicates };
}

export function addNote(state: CrmState, leadId: string, body: string, actorId: string) {
  const text = body.trim();
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead || !text) return state;
  const now = new Date().toISOString();
  const next: CrmState = {
    ...state,
    leads: state.leads.map((item) =>
      item.id === leadId
        ? { ...item, notes: item.notes ? `${item.notes}\n${text}` : text, noteEntries: [{ id: uid("note"), body: text, userId: actorId, createdAt: now }, ...item.noteEntries], updatedAt: now }
        : item,
    ),
  };
  return withActivity(
    next,
    activity({ userId: actorId, leadId, leadName: lead.fullName, type: "note", action: "Note added", details: text }),
  );
}

export function updateDocument(state: CrmState, leadId: string, documentId: string, status: Lead["documents"][number]["status"], actorId: string) {
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return state;
  const document = lead.documents.find((item) => item.id === documentId);
  const next: CrmState = {
    ...state,
    leads: state.leads.map((item) =>
      item.id === leadId
        ? { ...item, documents: item.documents.map((doc) => (doc.id === documentId ? { ...doc, status } : doc)), updatedAt: new Date().toISOString() }
        : item,
    ),
  };
  return withActivity(
    next,
    activity({
      userId: actorId,
      leadId,
      leadName: lead.fullName,
      type: "note",
      action: "Document updated",
      details: `${document?.name ?? "Document"} marked ${status}.`,
    }),
  );
}

export function logCommunication(state: CrmState, leadId: string, kind: "call" | "email", body: string, actorId: string, durationSeconds = 0) {
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) return state;
  const now = new Date().toISOString();
  const seconds = kind === "call" ? Math.max(0, Math.round(durationSeconds)) : 0;
  const calls = kind === "call"
    ? [...(state.calls ?? []), { id: uid("call"), leadId, userId: actorId, startedAt: now, durationSeconds: seconds, notes: body.trim() }]
    : state.calls ?? [];
  const next: CrmState = {
    ...state,
    calls,
    leads: state.leads.map((item) =>
      item.id === leadId
        ? {
            ...item,
            lastContactAt: now,
            updatedAt: now,
            callCount: item.callCount + (kind === "call" ? 1 : 0),
            talkSeconds: item.talkSeconds + seconds,
          }
        : item,
    ),
  };
  const minutes = Math.max(1, Math.round(seconds / 60));
  return withActivity(
    next,
    activity({
      userId: actorId,
      leadId,
      leadName: lead.fullName,
      type: kind,
      action: kind === "call" ? "Call logged" : "Email logged",
      details: body.trim() || (kind === "call" ? `Demo Mode — ${minutes} min call logged. No phone network was used.` : "Demo Mode — email logged, no email was sent."),
    }),
  );
}

export function saveUser(state: CrmState, input: Omit<User, "id"> & { id?: string }): MutationResult<User | null> {
  if (!input.name.trim() || !input.email.trim()) return { state, result: null, error: "Name and email are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return { state, result: null, error: "Invalid email." };
  const email = input.email.trim().toLowerCase();
  if (state.users.some((user) => user.email.toLowerCase() === email && user.id !== input.id)) {
    return { state, result: null, error: "A team member with this email already exists." };
  }
  if (input.id) {
    const updated = state.users.map((user) => (user.id === input.id ? { ...user, ...input, id: user.id, email } : user));
    return { state: { ...state, users: updated }, result: updated.find((user) => user.id === input.id) ?? null };
  }
  const user: User = { ...input, id: uid("usr"), email, name: input.name.trim() };
  return { state: { ...state, users: [...state.users, user] }, result: user };
}

export function deleteUser(state: CrmState, id: string, actorId: string): MutationResult<null> {
  const user = state.users.find((item) => item.id === id);
  if (!user) return { state, result: null, error: "Team member not found." };
  if (user.role === "administrator") return { state, result: null, error: "The administrator account cannot be removed." };
  const next = withActivity(
    {
      ...state,
      users: state.users.filter((item) => item.id !== id),
      leads: state.leads.map((lead) => (lead.assignedTo === id ? { ...lead, assignedTo: "" } : lead)),
    },
    activity({
      userId: actorId,
      leadId: null,
      leadName: null,
      type: "deleted",
      action: "Team member removed",
      details: `${user.name} was removed. Their open leads returned to the fresh queue.`,
    }),
  );
  return { state: next, result: null };
}

export function markNotification(state: CrmState, id: string, read = true) {
  return { ...state, notifications: state.notifications.map((item) => (item.id === id ? { ...item, read } : item)) };
}

export function markAllNotifications(state: CrmState) {
  return { ...state, notifications: state.notifications.map((item) => ({ ...item, read: true })) };
}

export function updateAutomation(state: CrmState, patch: Partial<CrmState["automation"]> & { nodes?: CrmState["automation"]["nodes"] }) {
  return { ...state, automation: { ...state.automation, ...patch } };
}

export function updateSettings(state: CrmState, settings: CrmState["settings"]) {
  return refreshSystem({ ...state, settings });
}

export function leadToInput(lead: Lead): LeadInput {
  return {
    fullName: lead.fullName,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    email: lead.email,
    gender: lead.gender,
    age: lead.age,
    location: lead.location,
    country: lead.country,
    position: lead.position,
    jobCategory: lead.jobCategory,
    experience: lead.experience,
    source: lead.source,
    priority: lead.priority,
    assignedTo: lead.assignedTo,
    status: lead.status,
    notes: lead.notes,
    tags: lead.tags,
  };
}

export function taskStatusLabel(status: TaskStatus) {
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  return "Pending";
}

export function bulkFollowUp(state: CrmState, ids: string[], type: FollowUpType, dueAt: string, notes: string, actorId: string) {
  let next = state;
  ids.forEach((leadId) => {
    next = addFollowUp(next, { leadId, type, dueAt, notes }, actorId).state;
  });
  return next;
}
