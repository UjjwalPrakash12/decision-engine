export type MetricImportRow = {
  date: string;
  revenue: number;
  customers: number;
  conversionRate: number;
  churnRate: number;
  avgOrderValue: number;
};

export type MetricImportError = {
  row: number;
  message: string;
};

export type MetricImportParseResult = {
  rows: MetricImportRow[];
  errors: MetricImportError[];
  totalRows: number;
  dedupedRows: number;
};

const REQUIRED_COLUMNS = [
  "date",
  "revenue",
  "customers",
  "conversionRate",
  "churnRate",
  "avgOrderValue",
] as const;

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dt = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0, 10) === value;
}

function parseFiniteNumber(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseRate(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const pct = parseFiniteNumber(trimmed.slice(0, -1));
    if (pct === null) return null;
    return pct / 100;
  }
  return parseFiniteNumber(trimmed);
}

function indexHeaders(headerCells: string[]): Record<RequiredColumn, number> | null {
  const map = new Map<string, number>();
  headerCells.forEach((h, idx) => {
    map.set(h.trim(), idx);
  });
  const indexes = {} as Record<RequiredColumn, number>;
  for (const col of REQUIRED_COLUMNS) {
    const idx = map.get(col);
    if (idx === undefined) return null;
    indexes[col] = idx;
  }
  return indexes;
}

export function parseMetricsCsv(csvText: string): MetricImportParseResult {
  const lines = csvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      errors: [{ row: 0, message: "CSV is empty." }],
      totalRows: 0,
      dedupedRows: 0,
    };
  }

  const header = parseCsvLine(lines[0]);
  const headerIndex = indexHeaders(header);
  if (!headerIndex) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message:
            "Invalid CSV headers. Required columns: date,revenue,customers,conversionRate,churnRate,avgOrderValue",
        },
      ],
      totalRows: 0,
      dedupedRows: 0,
    };
  }

  const errors: MetricImportError[] = [];
  const dedupMap = new Map<string, MetricImportRow>();
  const seenDateRow = new Map<string, number>();
  let totalRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    totalRows++;
    const cells = parseCsvLine(lines[i]);

    const get = (col: RequiredColumn) => cells[headerIndex[col]] ?? "";
    const date = get("date");
    const revenueRaw = get("revenue");
    const customersRaw = get("customers");
    const conversionRaw = get("conversionRate");
    const churnRaw = get("churnRate");
    const avgOrderRaw = get("avgOrderValue");

    const rowErrors: string[] = [];

    if (!isIsoDate(date)) {
      rowErrors.push("date must be ISO yyyy-mm-dd");
    }

    const revenue = parseFiniteNumber(revenueRaw);
    const customers = parseFiniteNumber(customersRaw);
    const conversionRate = parseRate(conversionRaw);
    const churnRate = parseRate(churnRaw);
    const avgOrderValue = parseFiniteNumber(avgOrderRaw);

    if (revenue === null) rowErrors.push("revenue must be a valid number");
    if (customers === null) rowErrors.push("customers must be a valid number");
    if (conversionRate === null) {
      rowErrors.push("conversionRate must be a decimal or percent string");
    }
    if (churnRate === null) {
      rowErrors.push("churnRate must be a decimal or percent string");
    }
    if (avgOrderValue === null) rowErrors.push("avgOrderValue must be a valid number");

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, message: rowErrors.join("; ") });
      continue;
    }

    const normalized: MetricImportRow = {
      date,
      revenue: revenue!,
      customers: customers!,
      conversionRate: conversionRate!,
      churnRate: churnRate!,
      avgOrderValue: avgOrderValue!,
    };

    if (dedupMap.has(date)) {
      const previousRow = seenDateRow.get(date);
      errors.push({
        row: rowNumber,
        message: `Duplicate date ${date}; keeping latest row${
          previousRow ? ` (replaces row ${previousRow})` : ""
        }.`,
      });
    }
    dedupMap.set(date, normalized);
    seenDateRow.set(date, rowNumber);
  }

  return {
    rows: Array.from(dedupMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    errors,
    totalRows,
    dedupedRows: dedupMap.size,
  };
}
