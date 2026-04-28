import type { DashboardData } from "@/lib/data";

export type ParsedRow = {
  date: string;
  revenue: number;
  customers: number;
  conversionRate: number;
  churnRate: number;
};

export type ParseResult = {
  success: boolean;
  data?: ParsedRow[];
  errors: string[];
  warnings: string[];
  rowCount: number;
};

const REQUIRED = ["date", "revenue", "customers", "conversion_rate", "churn_rate"] as const;

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

/** Split CSV line respecting quoted fields. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === value;
}

function normalizeHeaderMap(headerCells: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerCells.forEach((h, idx) => {
    map.set(h.trim().toLowerCase(), idx);
  });
  return map;
}

/**
 * Parses owner-uploaded KPI CSV entirely in the browser.
 *
 * Assumptions:
 * - Header row required; names matched case-insensitively.
 * - `conversion_rate` / `churn_rate` are decimal percentages in 0–100 (e.g. 2.4 → 2.4%).
 * - Output `ParsedRow` stores rates as decimals in [0, 1] for downstream `DashboardData`.
 * - Extra columns are ignored.
 * - Rows with missing/invalid fields are skipped with warnings.
 */
export function parseCSV(rawText: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const text = stripBom(rawText.trim());
  if (text.length === 0) {
    return {
      success: false,
      errors: ["The file appears to be empty. Please add at least 7 rows of data."],
      warnings: [],
      rowCount: 0,
    };
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      success: false,
      errors: ["The file appears to be empty. Please add at least 7 rows of data."],
      warnings: [],
      rowCount: 0,
    };
  }

  const headerCells = parseCsvLine(lines[0]);
  const headerMap = normalizeHeaderMap(headerCells);

  for (const col of REQUIRED) {
    if (!headerMap.has(col)) {
      errors.push(`Missing required column: ${col}`);
      return { success: false, errors, warnings, rowCount: 0 };
    }
  }

  const rows: ParsedRow[] = [];
  let rawRowCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    rawRowCount++;
    const cells = parseCsvLine(lines[i]);
    const date = cells[headerMap.get("date")!] ?? "";
    const revenueStr = cells[headerMap.get("revenue")!] ?? "";
    const customersStr = cells[headerMap.get("customers")!] ?? "";
    const convStr = cells[headerMap.get("conversion_rate")!] ?? "";
    const churnStr = cells[headerMap.get("churn_rate")!] ?? "";

    if ([date, revenueStr, customersStr, convStr, churnStr].some((v) => v.trim() === "")) {
      warnings.push(`Row ${lineNum}: missing or empty value — row skipped.`);
      continue;
    }

    if (!isIsoDate(date)) {
      warnings.push(`Row ${lineNum}: invalid date '${date}' — row skipped.`);
      continue;
    }

    const revenue = Number(revenueStr);
    const customers = Number(customersStr);
    const convPct = Number(convStr);
    const churnPct = Number(churnStr);

    if (!Number.isFinite(revenue) || revenue <= 0) {
      warnings.push(
        `Row ${lineNum}: revenue must be a positive number — row skipped.`,
      );
      continue;
    }
    if (
      !Number.isFinite(customers) ||
      customers <= 0 ||
      Math.floor(customers) !== customers
    ) {
      warnings.push(`Row ${lineNum}: customers must be a positive integer — row skipped.`);
      continue;
    }
    if (!Number.isFinite(convPct) || convPct < 0 || convPct > 100) {
      warnings.push(
        `Row ${lineNum}: conversion_rate or churn_rate out of range — row skipped.`,
      );
      continue;
    }
    if (!Number.isFinite(churnPct) || churnPct < 0 || churnPct > 100) {
      warnings.push(
        `Row ${lineNum}: conversion_rate or churn_rate out of range — row skipped.`,
      );
      continue;
    }

    rows.push({
      date,
      revenue,
      customers,
      conversionRate: convPct / 100,
      churnRate: churnPct / 100,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length > 365) {
    errors.push("CSV has more than 365 rows. Maximum allowed is 365.");
    return { success: false, errors, warnings, rowCount: rows.length };
  }

  if (rows.length < 7) {
    errors.push(
      `Only ${rows.length} valid rows found after filtering. Minimum is 7 days of data.`,
    );
    return { success: false, errors, warnings, rowCount: rows.length };
  }

  return {
    success: true,
    data: rows,
    errors,
    warnings,
    rowCount: rows.length,
  };
}

/**
 * Maps parsed rows into {@link DashboardData} used by the rule engine and charts.
 * `avgOrderValue` is derived as revenue / customers when not present in CSV.
 */
export function parsedRowsToMetrics(rows: ParsedRow[]): DashboardData {
  const labels = rows.map((r) => r.date);
  const revenue = rows.map((r) => r.revenue);
  const customers = rows.map((r) => r.customers);
  const conversionRate = rows.map((r) => r.conversionRate);
  const churnRate = rows.map((r) => r.churnRate);
  const avgOrderValue = rows.map((r) =>
    Math.round((r.revenue / Math.max(1, r.customers)) * 100) / 100,
  );

  return {
    labels,
    revenue,
    customers,
    conversionRate,
    churnRate,
    avgOrderValue,
  };
}
