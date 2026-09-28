import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DayFilterValue, DayPreset } from "@/lib/day-filter";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function DayFilter({
  value,
  years,
  label,
  onChange,
}: {
  value: DayFilterValue;
  years: string[];
  label: string;
  onChange: (value: DayFilterValue) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3">
      <p className="text-sm font-semibold">Summary</p>
      <span className="text-muted">|</span>
      <p className="text-sm text-muted">{label}</p>
      <Select
        className="w-40"
        aria-label="Day filter"
        value={value.preset}
        onChange={(event) => onChange({ ...value, preset: event.target.value as DayPreset })}
      >
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="day">One day</option>
        <option value="month">Month</option>
        <option value="year">Year</option>
        <option value="all">All days</option>
      </Select>
      {value.preset === "day" ? (
        <Input className="w-40" type="date" aria-label="Pick a day" value={value.day} onChange={(event) => onChange({ ...value, day: event.target.value })} />
      ) : null}
      {value.preset === "month" ? (
        <Select className="w-36" aria-label="Month" value={value.month} onChange={(event) => onChange({ ...value, month: event.target.value })}>
          {MONTHS.map((month, index) => (
            <option key={month} value={String(index + 1).padStart(2, "0")}>{month}</option>
          ))}
        </Select>
      ) : null}
      {value.preset === "month" || value.preset === "year" ? (
        <Select className="w-28" aria-label="Year" value={value.year} onChange={(event) => onChange({ ...value, year: event.target.value })}>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </Select>
      ) : null}
    </div>
  );
}
