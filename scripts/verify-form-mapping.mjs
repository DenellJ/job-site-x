import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");

function loadPureTypeScript(relativePath) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const exports = {};
  new Function("exports", "require", output)(exports, () => {
    throw new Error(`Unexpected runtime import in ${relativePath}`);
  });
  return exports;
}

const definitions = loadPureTypeScript("convex/formDefs.ts");
const values = loadPureTypeScript("convex/formValues.ts");

assert.equal(definitions.FORM_TYPES.length, 6, "all six forms must be registered");

for (const formType of definitions.FORM_TYPES) {
  const definition = definitions.FORM_DEFS[formType];
  assert.ok(definition, `missing definition for ${formType}`);
  const fields = definition.sections.flatMap((section) => section.fields);
  const ids = fields.map((field) => field.id);
  assert.equal(new Set(ids).size, ids.length, `${formType} contains duplicate field ids`);
}

const solarFields = definitions.flatFields("site_visit_solar");
assert.equal(solarFields.find((field) => field.id === "solar_loads")?.type, "load_table");
assert.equal(solarFields.some((field) => field.id === "offgrid_choice"), true);

const row = {
  equipment: "Refrigerator",
  quantity: 1,
  totalWatts: 300,
  hoursPerDay: 8,
  wattHoursPerDay: 2400,
};
assert.equal(values.displayFormValue(true), "Yes");
assert.equal(values.displayFormValue(" legacy value "), "legacy value");
assert.equal(values.displayFormValue([row]), "Refrigerator | Qty 1 | 300 W | 8 h/day | 2400 Wh/day");
assert.equal(values.isEmptyFormValue([]), true);
assert.equal(values.isEmptyFormValue([{ ...row, equipment: "" }]), true);
assert.equal(values.MAX_LOAD_ROWS, 25);

const validatorSource = fs.readFileSync(path.join(root, "convex/validators.ts"), "utf8");
assert.match(validatorSource, /v\.literal\("load_table"\)/);
assert.match(validatorSource, /v\.array\(loadScheduleRowValidator\)/);

console.log("Form mapping checks passed.");
