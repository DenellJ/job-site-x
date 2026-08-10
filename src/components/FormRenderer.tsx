import type { FormFieldDef, FormSection, FormValue, LoadScheduleRow } from "../forms";
import { MediaGallery } from "./MediaGallery";
import { SketchPad } from "./SketchPad";
import type { UploadedMedia } from "../lib/types";

/** Editable renderer for a form definition's sections + fields. */
export function FormRenderer({
  sections,
  values,
  onChange,
  attachments,
  onAttachmentsChange,
  onBeforeCapture,
}: {
  sections: FormSection[];
  values: Record<string, FormValue>;
  onChange: (id: string, value: FormValue | undefined) => void;
  attachments: UploadedMedia[];
  onAttachmentsChange: (next: UploadedMedia[]) => void;
  onBeforeCapture?: () => void;
}) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title} className="card space-y-3">
          <h3 className="section-title">{section.title}</h3>
          {section.note && (
            <p className="text-sm text-rebar bg-stone-50 border border-stone-200 rounded-md p-2">
              {section.note}
            </p>
          )}
          {section.media ? (
            <MediaGallery
              value={attachments}
              onChange={onAttachmentsChange}
              accent
              onBeforeCapture={onBeforeCapture}
            />
          ) : (
            section.fields.map((field) => (
              <Field
                key={field.id}
                field={field}
                value={values[field.id]}
                onChange={(v) => onChange(field.id, v)}
              />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: FormFieldDef;
  value: FormValue | undefined;
  onChange: (value: FormValue | undefined) => void;
}) {
  const label = (
    <label className="label">
      {field.label}
      {field.required && <span className="text-err"> *</span>}
    </label>
  );

  if (field.type === "yesno") {
    return (
      <div>
        {label}
        <div className="flex gap-2">
          {([true, false] as const).map((bool) => (
            <button
              key={String(bool)}
              type="button"
              onClick={() => onChange(value === bool ? undefined : bool)}
              className={`btn flex-1 !min-h-[44px] ${
                value === bool ? "bg-ink text-concrete" : "bg-white text-ink"
              }`}
            >
              {bool ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        {label}
        <select
          className="input"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">— Select —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "sketch") {
    return (
      <div>
        {label}
        <SketchPad
          value={typeof value === "string" ? value : undefined}
          onChange={(dataUrl) => onChange(dataUrl)}
        />
      </div>
    );
  }

  if (field.type === "load_table") {
    const rows = Array.isArray(value) ? value : [];
    const updateRow = (index: number, patch: Partial<LoadScheduleRow>) => {
      onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    };
    const numberValue = (raw: string) => (raw === "" ? null : Number(raw));
    return (
      <div className="space-y-2">
        {label}
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-rebar">Load {index + 1}</span>
                <button type="button" className="text-xs font-bold text-err underline" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
                  Remove
                </button>
              </div>
              <input className="input" aria-label={`Load ${index + 1} equipment`} placeholder="Equipment description" value={row.equipment} onChange={(e) => updateRow(index, { equipment: e.target.value })} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input className="input" type="number" min="0" aria-label={`Load ${index + 1} quantity`} placeholder="Quantity" value={row.quantity ?? ""} onChange={(e) => updateRow(index, { quantity: numberValue(e.target.value) })} />
                <input className="input" type="number" min="0" aria-label={`Load ${index + 1} watts`} placeholder="Total watts" value={row.totalWatts ?? ""} onChange={(e) => updateRow(index, { totalWatts: numberValue(e.target.value) })} />
                <input className="input" type="number" min="0" step="0.1" aria-label={`Load ${index + 1} hours per day`} placeholder="Hours/day" value={row.hoursPerDay ?? ""} onChange={(e) => updateRow(index, { hoursPerDay: numberValue(e.target.value) })} />
                <input className="input" type="number" min="0" aria-label={`Load ${index + 1} watt hours per day`} placeholder="Wh/day" value={row.wattHoursPerDay ?? ""} onChange={(e) => updateRow(index, { wattHoursPerDay: numberValue(e.target.value) })} />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost w-full !min-h-[44px] !py-2"
          disabled={rows.length >= 25}
          onClick={() => onChange([...rows, { equipment: "", quantity: null, totalWatts: null, hoursPerDay: null, wattHoursPerDay: null }])}
        >
          + Add load
        </button>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        {label}
        <textarea
          className="input"
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        {label}
        <input
          className="input"
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </div>
    );
  }

  // text | time
  return (
    <div>
      {label}
      <input
        className="input"
        type={field.type === "time" ? "time" : "text"}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </div>
  );
}
