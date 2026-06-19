/**
 * Single source of truth for the five Resscott Section-2 digital forms.
 *
 * Pure data + types only — NO Convex server APIs — so it can be imported by both
 * Convex functions (`convex/*`) and the React client (`src/*`).
 *
 * The Site Visit and Solar Water Heater forms are digital replicas of the sample
 * documents in `sample forms/`. Job Inspections, Job Ticket and New Job Task have
 * no sample yet — their fields are a reasonable draft to be confirmed during
 * Resscott's form sign-off (Phase 1 of the work plan).
 */

export type FormType =
  | "site_visit"
  | "job_inspection"
  | "solar_water_heater"
  | "job_ticket"
  | "new_job_task";

export type FormFieldType = "text" | "textarea" | "number" | "yesno" | "select" | "time";

export interface FormFieldDef {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  /** Only for "select" fields. */
  options?: string[];
}

export interface FormSection {
  title: string;
  /** Optional guidance text (e.g. the "ensure pictures of the following" checklist). */
  note?: string;
  /** When true, the section captures photos/videos (into the submission's
   *  attachments) instead of rendering form fields. */
  media?: boolean;
  fields: FormFieldDef[];
}

export interface FormDef {
  type: FormType;
  title: string;
  sections: FormSection[];
}

export const FORM_TYPES: FormType[] = [
  "site_visit",
  "job_inspection",
  "solar_water_heater",
  "job_ticket",
  "new_job_task",
];

export const FORM_LABELS: Record<FormType, string> = {
  site_visit: "Site Visit",
  job_inspection: "Job Inspections",
  solar_water_heater: "Solar Water Heater",
  job_ticket: "Job Ticket",
  new_job_task: "New Job Task",
};

// Shared visit-detail fields used by the two Site Visit-style forms.
const visitDetailFields: FormFieldDef[] = [
  { id: "conductor", label: "Who is conducting the visit?", type: "text", required: true },
  { id: "time_arrived", label: "Time arrived", type: "time", required: true },
  { id: "client_name", label: "Name of client", type: "text", required: true },
  { id: "client_number", label: "Client contact number", type: "text", required: false },
  { id: "client_email", label: "Client email", type: "text", required: false },
  { id: "client_location", label: "Location of client", type: "textarea", required: true },
  {
    id: "client_type",
    label: "Is the client",
    type: "select",
    required: true,
    options: ["Domestic", "Commercial", "Industrial", "Agricultural"],
  },
];

export const FORM_DEFS: Record<FormType, FormDef> = {
  site_visit: {
    type: "site_visit",
    title: "Site Visit",
    sections: [
      { title: "Visit Details", fields: visitDetailFields },
      {
        title: "Site Photos",
        media: true,
        note: "Take photos of: the appliances to be powered, the roof spaces, the appliance specification sheets, the breaker panel (if any), and the client's utility bill (if any).",
        fields: [],
      },
      {
        title: "Site Assessment",
        fields: [
          {
            id: "system_type",
            label: "System type",
            type: "select",
            required: true,
            options: ["Solar System", "Lighting"],
          },
          { id: "ttec_access", label: "Do you have T&TEC access?", type: "textarea", required: false },
          {
            id: "offgrid_loads",
            label:
              "Completely off-grid or partial? List loads to be solar-powered (equipment, qty, total watts, hours/day, Wh/day)",
            type: "textarea",
            required: false,
          },
          { id: "budget", label: "Client's budget", type: "text", required: false },
          { id: "shading", label: "Does the building have any shading?", type: "textarea", required: false },
          {
            id: "construction_followup",
            label: "If under construction: expected completion date and follow-up date",
            type: "textarea",
            required: false,
          },
          {
            id: "electrical_by",
            label: "Who will do the electrical work?",
            type: "select",
            required: false,
            options: ["RESSCOTT", "Client / Other"],
          },
          {
            id: "roof_orientation",
            label: "Is the roof North-South or East-West?",
            type: "select",
            required: false,
            options: ["North-South", "East-West"],
          },
          { id: "breaker_location", label: "Where is the breaker panel located?", type: "textarea", required: false },
          {
            id: "system_storage",
            label: "Where will the batteries and system (charge controller / inverter) be stored?",
            type: "textarea",
            required: false,
          },
          { id: "additional_notes", label: "Additional notes", type: "textarea", required: false },
        ],
      },
    ],
  },

  solar_water_heater: {
    type: "solar_water_heater",
    title: "Solar Water Heater",
    sections: [
      { title: "Visit Details", fields: visitDetailFields },
      {
        title: "Site Photos",
        media: true,
        note: "Take photos of: the hot water line, the roof space, where the pump can be stored, the closest 220V output plug, and the incoming water line.",
        fields: [],
      },
      {
        title: "Site Assessment",
        fields: [
          { id: "household_size", label: "Number of persons in the household", type: "number", required: false },
          {
            id: "hot_water_line",
            label: "Where is the hot water line located (where to tap off from)?",
            type: "textarea",
            required: false,
          },
          {
            id: "roof_orientation",
            label: "Is the roof North-South or East-West?",
            type: "select",
            required: false,
            options: ["North-South", "East-West"],
          },
          { id: "closest_220v", label: "Where is the closest 220V plug?", type: "textarea", required: false },
          { id: "additional_notes", label: "Additional notes", type: "textarea", required: false },
        ],
      },
    ],
  },

  job_inspection: {
    type: "job_inspection",
    title: "Job Inspections",
    sections: [
      {
        title: "Inspection Details",
        fields: [
          { id: "inspection_date", label: "Inspection date", type: "text", required: false },
          { id: "inspector", label: "Inspector", type: "text", required: true },
          { id: "client_site", label: "Client / site", type: "text", required: true },
          {
            id: "system_type",
            label: "System type",
            type: "select",
            required: false,
            options: ["Solar PV", "Solar Water Heater", "Lighting", "Other"],
          },
        ],
      },
      {
        title: "Inspection Checklist",
        fields: [
          { id: "check_panels", label: "Panels secure & intact", type: "yesno", required: false },
          { id: "check_wiring", label: "Wiring & connections OK", type: "yesno", required: false },
          { id: "check_inverter", label: "Inverter functioning", type: "yesno", required: false },
          { id: "check_batteries", label: "Batteries / storage OK", type: "yesno", required: false },
          { id: "check_mounting", label: "Mounting & structure OK", type: "yesno", required: false },
          { id: "defects_notes", label: "Defects / observations", type: "textarea", required: false },
        ],
      },
      {
        title: "Outcome",
        fields: [
          {
            id: "overall_result",
            label: "Overall result",
            type: "select",
            required: false,
            options: ["Pass", "Pass with notes", "Fail"],
          },
          { id: "recommendations", label: "Recommendations", type: "textarea", required: false },
        ],
      },
    ],
  },

  job_ticket: {
    type: "job_ticket",
    title: "Job Ticket",
    sections: [
      {
        title: "Ticket",
        fields: [
          { id: "ticket_date", label: "Date", type: "text", required: false },
          { id: "client_name", label: "Client", type: "text", required: true },
          { id: "site_location", label: "Site location", type: "textarea", required: false },
          {
            id: "job_type",
            label: "Job type",
            type: "select",
            required: false,
            options: ["Installation", "Maintenance", "Repair", "Inspection", "Other"],
          },
        ],
      },
      {
        title: "Work",
        fields: [
          { id: "work_description", label: "Description of work", type: "textarea", required: true },
          { id: "materials_used", label: "Materials used", type: "textarea", required: false },
          { id: "time_started", label: "Time started", type: "time", required: false },
          { id: "time_finished", label: "Time finished", type: "time", required: false },
          { id: "technician", label: "Technician", type: "text", required: false },
        ],
      },
      {
        title: "Status",
        fields: [
          {
            id: "status",
            label: "Status",
            type: "select",
            required: false,
            options: ["Completed", "In progress", "Follow-up required"],
          },
          { id: "notes", label: "Notes", type: "textarea", required: false },
        ],
      },
    ],
  },

  new_job_task: {
    type: "new_job_task",
    title: "New Job Task",
    sections: [
      {
        title: "Task",
        fields: [
          { id: "task_title", label: "Task title", type: "text", required: true },
          { id: "client_site", label: "Client / site", type: "text", required: false },
          {
            id: "priority",
            label: "Priority",
            type: "select",
            required: false,
            options: ["Low", "Medium", "High", "Urgent"],
          },
          { id: "due_date", label: "Due date", type: "text", required: false },
        ],
      },
      {
        title: "Details",
        fields: [
          { id: "description", label: "Description", type: "textarea", required: true },
          { id: "assigned_to", label: "Assigned to", type: "text", required: false },
          { id: "notes", label: "Notes", type: "textarea", required: false },
        ],
      },
    ],
  },
};

export function getFormDef(type: FormType): FormDef {
  return FORM_DEFS[type];
}

/** Flattened field list (across sections) — snapshotted onto a submission. */
export function flatFields(type: FormType): FormFieldDef[] {
  return FORM_DEFS[type].sections.flatMap((s) => s.fields);
}

/** Human-friendly label for a submission, derived from its key field. */
export function deriveLabel(type: FormType, values: Record<string, string | number | boolean>): string {
  const candidates = ["client_name", "client_site", "task_title", "inspector"];
  for (const key of candidates) {
    const v = values[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return FORM_LABELS[type];
}
