/**
 * Server-side helpers over the shared form definitions (`./formDefs`).
 * Plain functions (not Convex functions) used by the submission mutations.
 */
import { flatFields, type FormType, type FormValue } from "./formDefs";
import { isEmptyFormValue } from "./formValues";

/** True when a submitted value counts as "filled". */
function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return !isEmptyFormValue(value as FormValue);
  return true; // numbers and booleans are always considered filled
}

/**
 * Validate that every required field of the form has a value.
 * Throws with the first missing field's label.
 */
export function validateRequired(
  formType: FormType,
  values: Record<string, FormValue>,
): void {
  for (const field of flatFields(formType)) {
    if (field.required && !isFilled(values[field.id])) {
      throw new Error(`"${field.label}" is required.`);
    }
  }
}
