import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { acquisitionSeries, conversionSeries, followUpSeries, pipelineSeries, sourceSeries } from "@/lib/metrics";
import type { CrmState, DateRangeKey } from "@/types";

const NAVY = "#1e3a5f";
const GRID = "#eef0f3";
const tooltipStyle = { border: "1px solid #e6e8ee", borderRadius: 8, fontSize: 12, boxShadow: "0 8px 24px rgba(16,24,40,0.08)" };

export function DashboardCharts({ state, range }: { state: CrmState; range: DateRangeKey }) {
  const acquisition = acquisitionSeries(state.leads, range);
  const pipeline = pipelineSeries(state.leads, range);
  const sources = sourceSeries(state.leads, range);
  const followUps = followUpSeries(state, range);
  const conversion = conversionSeries(state.leads, range);
  const followColors = ["#0f7a45", "#1e3a5f", "#b45309"];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Lead acquisition" subtitle={range === "month" ? "Leads added this month" : range === "week" ? "Last 7 days" : "Today by hour"}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={acquisition} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="leads" stroke={NAVY} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Enquiry pipeline" subtitle="Leads created in the selected range">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={pipeline} layout="vertical" margin={{ top: 8, right: 8, left: 24, bottom: 0 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={118} tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill={NAVY} radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Lead sources" subtitle="Where this period's enquiries came from">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={sources} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 11 }} interval={0} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#8aa0b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Follow-up performance" subtitle="Completed, pending and overdue">
        <div className="flex h-[260px] items-center gap-6">
          <ResponsiveContainer width="55%" height="100%">
            <PieChart>
              <Pie data={followUps} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                {followUps.map((entry, index) => (
                  <Cell key={entry.name} fill={followColors[index]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-2 text-sm">
            {followUps.map((entry, index) => (
              <li key={entry.name} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: followColors[index] }} />
                <span className="text-muted">{entry.name}</span>
                <span className="font-medium tabular">{entry.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </ChartCard>
      <ChartCard className="xl:col-span-2" title="Monthly conversion" subtitle={range === "month" ? "Converted candidates over six months" : "Conversions in the selected range"}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={conversion} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#667085", fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="converted" stroke="#0f7a45" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = "" }: { title: string; subtitle: string; children: ReactNode; className?: string }) {
  return (
    <Card className={`p-4 ${className}`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-2 text-xs text-muted">{subtitle}</p>
      {children}
    </Card>
  );
}
