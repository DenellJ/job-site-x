import type { FormValue, LoadScheduleRow } from "./formDefs";

export const MAX_LOAD_ROWS = 25;

export function isLoadSchedule(value: FormValue | undefined): value is LoadScheduleRow[] {
  return Array.isArray(value) && (value.length === 0 || (typeof value[0] === "object" && value[0] !== null && "equipment" in value[0]));
}

export function isEmptyFormValue(value: FormValue | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    if (typeof value[0] === "string") return (value as string[]).every((item) => !item.trim());
    return (value as Array<Record<string, unknown>>).every((row) => Object.values(row).every((item) => String(item ?? "").trim() === ""));
  }
  return false;
}

export function formatLoadRow(row: LoadScheduleRow): string {
  const parts = [
    row.equipment.trim() || "Unnamed equipment",
    row.quantity == null ? null : `Qty ${row.quantity}`,
    row.totalWatts == null ? null : `${row.totalWatts} W`,
    row.hoursPerDay == null ? null : `${row.hoursPerDay} h/day`,
    row.wattHoursPerDay == null ? null : `${row.wattHoursPerDay} Wh/day`,
  ];
  return parts.filter((part): part is string => part !== null).join(" | ");
}

export function displayFormValue(value: FormValue | undefined): string {
  if (value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "string") return (value as string[]).join(", ");
    if (isLoadSchedule(value)) return value.map(formatLoadRow).join("\n");
    return (value as Array<Record<string, string>>).map((row) => Object.entries(row).map(([key, item]) => `${key}: ${item}`).join(" | ")).join("\n");
  }
  const text = String(value).trim();
  return text || "—";
}
