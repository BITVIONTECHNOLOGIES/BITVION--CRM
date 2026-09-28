import { endOfMonth, format, subDays } from "date-fns";

export type DayPreset = "today" | "yesterday" | "day" | "month" | "year" | "all";

export interface DayFilterValue {
  preset: DayPreset;
  day: string;
  month: string;
  year: string;
}

export function defaultDayFilter(now = new Date()): DayFilterValue {
  return {
    preset: "today",
    day: format(now, "yyyy-MM-dd"),
    month: format(now, "MM"),
    year: format(now, "yyyy"),
  };
}

export function localDay(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd");
}

export function inDayRange(iso: string, from: string | null, to: string | null) {
  const day = localDay(iso);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function dayFilterBounds(value: DayFilterValue, now = new Date()) {
  if (value.preset === "today") {
    const day = format(now, "yyyy-MM-dd");
    return { from: day, to: day, label: `Today · ${format(now, "d MMM yyyy")}` };
  }
  if (value.preset === "yesterday") {
    const date = subDays(now, 1);
    const day = format(date, "yyyy-MM-dd");
    return { from: day, to: day, label: `Yesterday · ${format(date, "d MMM yyyy")}` };
  }
  if (value.preset === "day" && value.day) {
    const date = new Date(`${value.day}T12:00:00`);
    return { from: value.day, to: value.day, label: format(date, "EEE, d MMM yyyy") };
  }
  if (value.preset === "month") {
    const start = new Date(Number(value.year), Number(value.month) - 1, 1);
    const end = endOfMonth(start);
    return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd"), label: format(start, "MMMM yyyy") };
  }
  if (value.preset === "year") {
    return { from: `${value.year}-01-01`, to: `${value.year}-12-31`, label: value.year };
  }
  return { from: null, to: null, label: "All days" };
}

export function yearsIn(isos: string[], now = new Date()) {
  const years = new Set<string>([format(now, "yyyy")]);
  isos.forEach((iso) => years.add(format(new Date(iso), "yyyy")));
  return [...years].sort((a, b) => Number(b) - Number(a));
}
