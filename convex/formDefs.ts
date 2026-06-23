/**
 * Single source of truth for the Resscott digital forms.
 *
 * Pure data + types only — NO Convex server APIs — so it can be imported by both
 * Convex functions (`convex/*`) and the React client (`src/*`).
 *
 * The three Site Visit forms and the Inspection form are digital replicas of the
 * documents in `sample forms/`. Each form's generated document mirrors the
 * matching sample (Site Visit → Servus letter; Inspection → IR-RES certificate).
 */

export type FormType =
  | "site_visit_lighting"
  | "site_visit_solar"
  | "site_visit_water_heater"
  | "job_inspection"
  | "job_ticket"
  | "new_job_task";

export type FormFieldType = "text" | "textarea" | "number" | "yesno" | "select" | "time" | "sketch";

export interface FormFieldDef {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
}

export interface FormSection {
  title: string;
  note?: string;
  /** When true the section captures photos/videos (into the submission's
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
  "site_visit_lighting",
  "site_visit_solar",
  "site_visit_water_heater",
  "job_inspection",
  "job_ticket",
  "new_job_task",
];

export const FORM_LABELS: Record<FormType, string> = {
  site_visit_lighting: "Site Visit — Lighting",
  site_visit_solar: "Site Visit — Solar Systems",
  site_visit_water_heater: "Site Visit — Solar Water Heaters",
  job_inspection: "Inspection",
  job_ticket: "Job Ticket",
  new_job_task: "New Job Task",
};

// ---- shared building blocks ----
const visitDetails: FormFieldDef[] = [
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

const ROOF = ["North-South", "East-West"];
const ELECTRICAL = ["RESSCOTT", "Client / Other"];

/** A `select` status + free-text comment pair (Inspection component rows). */
function statusPair(id: string, label: string, options: string[]): FormFieldDef[] {
  return [
    { id: `${id}_status`, label, type: "select", required: false, options },
    { id: `${id}_comment`, label: `${label} — comments`, type: "text", required: false },
  ];
}
const TESTED = ["Tested & OK", "Faulty", "N/A"];
const ORDER = ["In good order", "Defect found", "N/A"];

export const FORM_DEFS: Record<FormType, FormDef> = {
  // ============ SITE VISIT — SOLAR SYSTEMS ============
  site_visit_solar: {
    type: "site_visit_solar",
    title: FORM_LABELS.site_visit_solar,
    sections: [
      { title: "Visit Details", fields: visitDetails },
      {
        title: "Site Photos",
        media: true,
        note: "Take photos of: the appliances to be powered, the roof spaces, the appliance specification sheets, the breaker panel (if any), and the client's utility bill (if any).",
        fields: [],
      },
      {
        title: "Site Assessment",
        fields: [
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
          { id: "electrical_by", label: "Who will do the electrical work?", type: "select", required: false, options: ELECTRICAL },
          { id: "roof_orientation", label: "Is the roof North-South or East-West?", type: "select", required: false, options: ROOF },
          { id: "site_sketch", label: "Sketch of the roof / site layout", type: "sketch", required: false },
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

  // ============ SITE VISIT — SOLAR WATER HEATERS ============
  site_visit_water_heater: {
    type: "site_visit_water_heater",
    title: FORM_LABELS.site_visit_water_heater,
    sections: [
      { title: "Visit Details", fields: visitDetails },
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
          { id: "roof_orientation", label: "Is the roof North-South or East-West?", type: "select", required: false, options: ROOF },
          { id: "site_sketch", label: "Sketch of the roof / plumbing layout", type: "sketch", required: false },
          { id: "closest_220v", label: "Where is the closest 220V plug?", type: "textarea", required: false },
          { id: "additional_notes", label: "Additional notes", type: "textarea", required: false },
        ],
      },
    ],
  },

  // ============ SITE VISIT — LIGHTING ============
  site_visit_lighting: {
    type: "site_visit_lighting",
    title: FORM_LABELS.site_visit_lighting,
    sections: [
      { title: "Visit Details", fields: visitDetails },
      {
        title: "Site Photos",
        media: true,
        note: "Take an overview photo of the area the client would like lit, plus any relevant surroundings.",
        fields: [],
      },
      {
        title: "Site Assessment",
        fields: [
          { id: "area_dimensions", label: "What are the dimensions of the area?", type: "textarea", required: false },
          { id: "cameras", label: "Would you like cameras with this system? (we supply)", type: "yesno", required: false },
          { id: "hours_of_light", label: "How many hours of light would best suffice? (e.g. 8, 12)", type: "text", required: false },
          { id: "budget", label: "Client's budget", type: "text", required: false },
          { id: "shading", label: "Does the home have any shading?", type: "textarea", required: false },
          {
            id: "construction_followup",
            label: "If under construction: expected completion date and follow-up date",
            type: "textarea",
            required: false,
          },
          { id: "electrical_by", label: "Who will do the electrical work?", type: "select", required: false, options: ELECTRICAL },
          { id: "roof_orientation", label: "Is the roof North-South or East-West?", type: "select", required: false, options: ROOF },
          { id: "site_sketch", label: "Sketch of the area to be lit", type: "sketch", required: false },
          { id: "breaker_location", label: "Where is the breaker panel located?", type: "textarea", required: false },
          {
            id: "system_storage",
            label: "Where will the batteries and system (charge controller / inverter) be stored?",
            type: "textarea",
            required: false,
          },
        ],
      },
    ],
  },

  // ============ INSPECTION (IR-RES certificate) ============
  job_inspection: {
    type: "job_inspection",
    title: FORM_LABELS.job_inspection,
    sections: [
      {
        title: "Equipment Details",
        fields: [
          { id: "occupier", label: "Occupier", type: "text", required: true },
          { id: "address", label: "Address", type: "textarea", required: false },
          { id: "description", label: "Description of solar system", type: "text", required: false },
          { id: "location", label: "Location", type: "text", required: false },
          { id: "serial_no", label: "Serial # / Local #", type: "text", required: false },
          { id: "rated_capacity", label: "Rated capacity", type: "text", required: false },
          { id: "date_construction", label: "Date of construction", type: "text", required: false },
          { id: "date_last_exam", label: "Date of last examination", type: "text", required: false },
          { id: "time_in_service", label: "How long equipment was in service", type: "text", required: false },
        ],
      },
      {
        title: "Type of Operation & Facility",
        fields: [
          {
            id: "operation_frequency",
            label: "How often system works",
            type: "select",
            required: false,
            options: ["Daily", "Weekly", "Monthly", "Intermittently"],
          },
          {
            id: "last_repaired",
            label: "Last repaired",
            type: "select",
            required: false,
            options: ["By OEM", "Locally", "No previous record"],
          },
          {
            id: "facility_type",
            label: "Type of facility",
            type: "select",
            required: false,
            options: [
              "Car park",
              "Warehouse (internal)",
              "Commercial",
              "Laydown yard",
              "Roadway / walkways",
              "General social compound",
              "Home / Residential",
              "Industrial",
              "Estate",
              "Park",
              "Sporting ground",
              "Stadium",
              "Other",
            ],
          },
        ],
      },
      {
        title: "Inverter & Battery Inspection",
        fields: [
          ...statusPair("inv_controls", "Controls", TESTED),
          ...statusPair("inv_push_buttons", "Push buttons", TESTED),
          ...statusPair("inv_fan", "Fan / cooler operation", TESTED),
          ...statusPair("inv_connections", "Positive / negative connections", TESTED),
          ...statusPair("inv_upper_trip", "Upper limit trip", TESTED),
          ...statusPair("inv_lower_trip", "Lower limit trip", TESTED),
          ...statusPair("inv_pv_input", "PV input connection", TESTED),
          ...statusPair("inv_load_output", "Load output", TESTED),
          ...statusPair("inv_safety", "Safety devices", TESTED),
          ...statusPair("inv_utility_charge", "Utility charge current (hybrid)", TESTED),
          ...statusPair("bat_wiring", "Battery bank wiring", TESTED),
          ...statusPair("bat_covering", "Battery bank covering", TESTED),
        ],
      },
      {
        title: "Solar Panels & Racking",
        fields: [
          ...statusPair("sp_enclosure", "(a) Enclosure / combiner box", ORDER),
          ...statusPair("sp_piping", "(b) Piping / conduit run", ORDER),
          ...statusPair("sp_racking", "(c) PV array racking", ORDER),
          ...statusPair("sp_panels", "(d) PV panels", ORDER),
          ...statusPair("sp_wiring", "(e) PV wiring to combiner box", ORDER),
          ...statusPair("sp_overrun", "(f) Over-running devices", ORDER),
          ...statusPair("sp_other_elec", "(g) Other electrical equipment", ORDER),
          ...statusPair("sp_frame", "(h) PV frame (ground / roof mounted)", ORDER),
          ...statusPair("sp_other", "(i) Other parts", ORDER),
          { id: "parts_inaccessible", label: "What parts were inaccessible? (if any)", type: "text", required: false },
        ],
      },
      {
        title: "During Inspection / Repair",
        fields: [
          { id: "issues_observed", label: "What issues were observed? (if any)", type: "textarea", required: false },
          { id: "notice_defects", label: "Notice of defects during repair / service (if any)", type: "textarea", required: false },
          { id: "repairs_done", label: "Repairs / service done — description of parts repaired", type: "textarea", required: false },
        ],
      },
      {
        title: "Photos",
        media: true,
        note: "Attach inspection photos (panel layout, breakers, inverter, transformer, PV arrays, etc.).",
        fields: [],
      },
      {
        title: "Outcome",
        fields: [
          { id: "recommendations", label: "Recommendations", type: "textarea", required: false },
          { id: "next_service_due", label: "Next service examination due", type: "text", required: false },
        ],
      },
    ],
  },

  // ============ JOB TICKET ============
  job_ticket: {
    type: "job_ticket",
    title: FORM_LABELS.job_ticket,
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
      { title: "Photos", media: true, note: "Attach any photos for this ticket.", fields: [] },
    ],
  },

  // ============ NEW JOB TASK ============
  new_job_task: {
    type: "new_job_task",
    title: FORM_LABELS.new_job_task,
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
      { title: "Photos", media: true, note: "Attach any photos for this task.", fields: [] },
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
  const candidates = ["client_name", "occupier", "client_site", "task_title", "conductor"];
  for (const key of candidates) {
    const v = values[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return FORM_LABELS[type];
}

/** True for the Site Visit family (whose report is an amendable Word document). */
export function isSiteVisit(type: FormType): boolean {
  return type === "site_visit_lighting" || type === "site_visit_solar" || type === "site_visit_water_heater";
}
