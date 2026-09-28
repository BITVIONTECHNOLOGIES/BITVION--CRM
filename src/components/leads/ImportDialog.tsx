import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useCrm } from "@/context/CrmContext";
import { SOURCE_LABEL, stageFromText } from "@/data/catalog";
import { downloadText, parseCsv, readExcelPhone, SAMPLE_CSV } from "@/lib/csv";
import { isValidPhone } from "@/lib/utils";
import type { LeadInput, LeadSource, Priority } from "@/types";

const FIELDS = [
  ["fullName", "Full name"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["whatsapp", "WhatsApp number"],
  ["position", "Position"],
  ["source", "Source"],
  ["status", "Stage"],
  ["priority", "Priority"],
  ["location", "Location"],
  ["country", "Country"],
  ["gender", "Gender"],
  ["age", "Age"],
  ["jobCategory", "Job category"],
  ["experience", "Experience"],
  ["notes", "Notes"],
] as const;

type FieldKey = (typeof FIELDS)[number][0];

function guess(headers: string[], label: string) {
  const needle = label.toLowerCase();
  const aliases = needle === "stage" ? ["stage", "status"] : needle === "location" ? ["location", "place"] : needle === "position" ? ["position", "interest"] : [needle];
  const index = headers.findIndex((header) => {
    const text = header.trim().toLowerCase();
    return aliases.some((alias) => text === alias || text.includes(alias.split(" ")[0] ?? alias));
  });
  return index >= 0 ? String(index) : "";
}

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { actorId, importLeads } = useCrm();
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [fileNote, setFileNote] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);

  const headers = rows[0] ?? [];
  const body = rows.slice(1);

  const mapped = useMemo(() => {
    return body.map((row, index) => {
      const value = (key: FieldKey) => row[Number(mapping[key] ?? -1)]?.trim() ?? "";
      const source = value("source").toLowerCase().replace(/[\s-]+/g, "_");
      const priority = value("priority").toLowerCase();
      const phone = readExcelPhone(value("phone"));
      const input: LeadInput = {
        fullName: value("fullName"),
        phone,
        whatsapp: readExcelPhone(value("whatsapp")) || phone,
        email: value("email"),
        gender: value("gender").toLowerCase() === "female" ? "female" : value("gender").toLowerCase() === "other" ? "other" : "male",
        age: Number(value("age") || 25),
        location: value("location") || "Kochi",
        country: value("country") || "India",
        position: value("position") || "Nurse – UAE",
        jobCategory: value("jobCategory") || "General",
        experience: value("experience") || "1 year",
        source: (source in SOURCE_LABEL ? source : "other") as LeadSource,
        priority: (["low", "medium", "high", "urgent"].includes(priority) ? priority : "medium") as Priority,
        assignedTo: actorId,
        status: stageFromText(value("status")),
        notes: value("notes"),
        tags: [],
      };
      const problems: string[] = [];
      if (input.fullName.length < 2) problems.push("Name missing");
      if (!isValidPhone(input.phone)) problems.push("Invalid phone");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) problems.push("Invalid email");
      return { index, input, problems };
    });
  }, [actorId, body, mapping]);

  const valid = mapped.filter((row) => row.problems.length === 0);
  const invalid = mapped.length - valid.length;
  const phones = new Set<string>();
  let duplicateRows = 0;
  valid.forEach((row) => {
    const key = row.input.phone.replace(/\D/g, "");
    if (phones.has(key)) duplicateRows += 1;
    phones.add(key);
  });

  const reset = () => {
    setStep("upload");
    setRows([]);
    setFileNote("");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>Upload the Excel CSV export. Stage names such as Converted, Booked, Consultation, and Details Pending are read back into the same stage.</DialogDescription>
        </DialogHeader>
        <ol className="mb-4 flex gap-3 text-xs text-muted">
          {["Upload", "Column mapping", "Preview"].map((label, index) => (
            <li key={label} className={step === ["upload", "map", "preview"][index] ? "font-semibold text-ink" : ""}>{index + 1}. {label}</li>
          ))}
        </ol>
        {step === "upload" ? (
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-10 text-sm text-muted hover:bg-slate-50">
              <span>Drop a CSV file or click to browse</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
                    setFileNote("Demo Mode — native Excel parsing is simulated. Export the sheet as CSV and upload that file.");
                    return;
                  }
                  const text = await file.text();
                  const parsed = parseCsv(text);
                  setRows(parsed);
                  const next = {} as Record<FieldKey, string>;
                  FIELDS.forEach(([key, label]) => { next[key] = guess(parsed[0] ?? [], label); });
                  setMapping(next);
                  setFileNote(`${file.name} · ${Math.max(parsed.length - 1, 0)} rows`);
                  setStep("map");
                }}
              />
            </label>
            {fileNote ? <p className="text-sm text-danger">{fileNote}</p> : null}
            <Button type="button" variant="secondary" onClick={() => downloadText("recruitflow-sample-leads.csv", SAMPLE_CSV)}>
              Download sample CSV
            </Button>
          </div>
        ) : null}
        {step === "map" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">{fileNote}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map(([key, label]) => (
                <label key={key} className="text-[13px] font-medium">
                  {label}
                  <Select className="mt-1" value={mapping[key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))}>
                    <option value="">Not mapped</option>
                    {headers.map((header, index) => (
                      <option key={`${header}-${index}`} value={String(index)}>{header || `Column ${index + 1}`}</option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={reset}>Back</Button>
              <Button type="button" onClick={() => setStep("preview")}>Validate</Button>
            </div>
          </div>
        ) : null}
        {step === "preview" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Total rows" value={mapped.length} />
              <Stat label="Valid rows" value={valid.length - duplicateRows} />
              <Stat label="Duplicate rows" value={duplicateRows} />
              <Stat label="Invalid rows" value={invalid} />
            </div>
            <div className="max-h-56 overflow-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Position</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 8).map((row) => (
                    <tr key={row.index} className="border-t border-line">
                      <td className="px-3 py-2">{row.input.fullName || "—"}</td>
                      <td className="px-3 py-2">{row.input.phone || "—"}</td>
                      <td className="px-3 py-2">{row.input.position}</td>
                      <td className="px-3 py-2">{row.problems.length ? row.problems.join(", ") : "Ready"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep("map")}>Back</Button>
              <Button
                type="button"
                disabled={valid.length - duplicateRows <= 0}
                onClick={() => {
                  const seen = new Set<string>();
                  const ready = valid.filter((row) => {
                    const key = row.input.phone.replace(/\D/g, "");
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  }).map((row) => row.input);
                  importLeads(ready);
                  reset();
                  onOpenChange(false);
                }}
              >
                Import
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-lg font-semibold tabular">{value}</p>
    </div>
  );
}
