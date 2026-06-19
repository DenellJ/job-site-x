import type { FormFieldDef, FormSection } from "../forms";
import { MediaGallery } from "./MediaGallery";
import type { UploadedMedia } from "../lib/types";

type Value = string | number | boolean;

/** Editable renderer for a form definition's sections + fields. */
export function FormRenderer({
  sections,
  values,
  onChange,
  attachments,
  onAttachmentsChange,
}: {
  sections: FormSection[];
  values: Record<string, Value>;
  onChange: (id: string, value: Value | undefined) => void;
  attachments: UploadedMedia[];
  onAttachmentsChange: (next: UploadedMedia[]) => void;
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
            <MediaGallery value={attachments} onChange={onAttachmentsChange} accent />
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
  value: Value | undefined;
  onChange: (value: Value | undefined) => void;
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
