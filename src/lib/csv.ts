export function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  downloadText(filename, `\uFEFF${toCsv(rows)}`);
}

export function excelPhone(phone: string) {
  const text = phone.trim();
  if (!text) return "";
  return `="${text}"`;
}

export function readExcelPhone(value: string) {
  const trimmed = value.trim();
  const formula = trimmed.match(/^="([\s\S]*)"$/);
  return (formula?.[1] ?? trimmed).replace(/^['\t]/, "");
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}

export const SAMPLE_CSV = `Full Name,Phone,Email,WhatsApp Number,Gender,Age,Location,Country,Position,Job Category,Experience,Source,Priority,Status,Notes
Amal Dev,+919876110001,amal.dev@gmail.com,+919876110001,male,26,Kochi,India,Nurse – UAE,Healthcare,3 years,Website,High,New,Available for Gulf deployment within 45 days
Liya Mathew,+919876110002,liya.mathew@gmail.com,+919876110002,female,24,Thrissur,India,Caregiver – Germany,Healthcare,2 years,Referral,Medium,New,German language classes in progress
Nikhil George,+919876110003,nikhil.george@gmail.com,+919876110003,male,29,Kozhikode,India,Electrician – UAE,Skilled Trades,6 years,Walk-in,Medium,New,Has valid passport and experience certificate
`;
