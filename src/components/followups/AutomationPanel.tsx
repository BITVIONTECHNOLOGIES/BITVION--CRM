import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCrm } from "@/context/CrmContext";
import { renderTemplate, userName } from "@/lib/template";
import { tomorrowAt10 } from "@/lib/dates";
import type { AutomationNode } from "@/types";

export function AutomationPanel() {
  const { state, updateAutomation, sendWhatsApp, createFollowUp, saveTask } = useCrm();
  const [selected, setSelected] = useState(state.automation.nodes[0]?.id ?? "");
  const [leadId, setLeadId] = useState(state.leads[0]?.id ?? "");
  const [running, setRunning] = useState<string | null>(null);
  const node = state.automation.nodes.find((item) => item.id === selected);

  const updateNode = (patch: Partial<AutomationNode>) => {
    updateAutomation({
      nodes: state.automation.nodes.map((item) => (item.id === selected ? { ...item, ...patch } : item)),
    });
  };

  const run = async () => {
    const lead = state.leads.find((item) => item.id === leadId);
    if (!lead) return;
    const steps = state.automation.nodes;
    for (const step of steps) {
      setRunning(step.id);
      await wait(450);
      if (!state.automation.enabled) continue;
      if (step.title.includes("Welcome")) {
        const template = state.templates.find((item) => item.key === "WELCOME_MESSAGE");
        if (template) sendWhatsApp({ leadId: lead.id, templateId: template.id, body: renderTemplate(template.body, lead, state.settings, userName(state.users, lead.assignedTo)) });
      }
      if (step.title.includes("Follow-up Message")) {
        const replied = state.messages.some((message) => message.leadId === lead.id && message.direction === "in");
        if (!replied) {
          const template = state.templates.find((item) => item.key === "FOLLOW_UP");
          if (template) sendWhatsApp({ leadId: lead.id, templateId: template.id, body: renderTemplate(template.body, lead, state.settings, userName(state.users, lead.assignedTo)) });
        }
      }
      if (step.title.includes("Call Task")) {
        const replied = state.messages.some((message) => message.leadId === lead.id && message.direction === "in");
        if (!replied) {
          saveTask({
            title: `Call ${lead.fullName}`,
            leadId: lead.id,
            assignedTo: lead.assignedTo,
            priority: "high",
            dueAt: tomorrowAt10(),
            taskType: "call",
            description: "Created by the welcome sequence after no reply.",
            status: "pending",
          });
        }
      }
      if (step.title === "Stop") {
        const replied = state.messages.some((message) => message.leadId === lead.id && message.direction === "in");
        if (replied) break;
      }
    }
    setRunning(null);
    createFollowUp({ leadId: lead.id, type: "general", dueAt: tomorrowAt10(), notes: "Sequence checkpoint" });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{state.automation.name}</h2>
            <p className="text-xs text-muted">Demo Mode — delays are simulated. No message leaves this browser.</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">Enabled <Switch checked={state.automation.enabled} onCheckedChange={(enabled) => updateAutomation({ enabled })} label="Enable automation" /></label>
            <label className="flex items-center gap-2">Run on new leads <Switch checked={state.automation.runOnNewLeads} onCheckedChange={(runOnNewLeads) => updateAutomation({ runOnNewLeads })} label="Run on new leads" /></label>
          </div>
        </div>
        <div className="space-y-3">
          {state.automation.nodes.map((item, index) => (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left ${running === item.id ? "border-navy bg-slate-50" : selected === item.id ? "border-navy" : "border-line"} ${item.branch === "yes" ? "ml-8" : ""} ${item.branch === "no" ? "ml-8" : ""}`}
              >
                <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{item.type}{item.branch ? ` · ${item.branch}` : ""}</p>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted">{item.description}</p>
              </button>
              {index < state.automation.nodes.length - 1 && item.type !== "condition" ? <div className="mx-auto h-4 w-px bg-line" /> : null}
              {item.type === "condition" ? <p className="py-1 text-center text-[11px] text-muted">Yes stops · No continues</p> : null}
            </div>
          ))}
        </div>
      </Card>
      <Card className="h-fit space-y-3 p-4">
        <h3 className="text-sm font-semibold">Edit node</h3>
        {node ? (
          <>
            <Input value={node.title} onChange={(event) => updateNode({ title: event.target.value })} />
            <Input value={node.description} onChange={(event) => updateNode({ description: event.target.value })} />
            {node.type === "delay" ? (
              <label className="block text-[13px]">
                Hours
                <Input className="mt-1" type="number" value={node.hours ?? 24} onChange={(event) => updateNode({ hours: Number(event.target.value), title: `Wait ${event.target.value} hours` })} />
              </label>
            ) : null}
          </>
        ) : null}
        <label className="block text-[13px]">
          Test with candidate
          <Select className="mt-1" value={leadId} onChange={(event) => setLeadId(event.target.value)}>
            {state.leads.slice(0, 30).map((lead) => <option key={lead.id} value={lead.id}>{lead.fullName}</option>)}
          </Select>
        </label>
        <Button type="button" className="w-full" onClick={() => void run()} disabled={!state.automation.enabled || Boolean(running)}>
          {running ? "Running sequence…" : "Run simulation"}
        </Button>
      </Card>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
