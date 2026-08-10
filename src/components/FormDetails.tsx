import type { FormFieldDef, FormValue } from "../forms";
import { isSketchValue } from "../forms";
import { displayFormValue } from "../../convex/formValues";

export function FormDetails({ fields, values }: { fields: FormFieldDef[]; values: Record<string, FormValue> }) {
  return (
    <>
      <ul className="divide-y divide-stone-100 text-sm">
        {fields.filter((field) => field.type !== "sketch" && !isSketchValue(values[field.id])).map((field) => (
          <li key={field.id} className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] sm:gap-4">
            <span className="min-w-0 break-words text-xs font-bold uppercase tracking-wide text-rebar">{field.label}</span>
            <span className="min-w-0 whitespace-pre-wrap break-words font-semibold sm:text-right">{displayFormValue(values[field.id])}</span>
          </li>
        ))}
      </ul>
      {fields.filter((field) => isSketchValue(values[field.id])).map((field) => (
        <div className="mt-4" key={field.id}>
          <h3 className="section-title">Sketch: {field.label}</h3>
          <img src={values[field.id] as string} alt={field.label} className="w-full rounded-lg border border-stone-200 bg-white" />
        </div>
      ))}
    </>
  );
}
