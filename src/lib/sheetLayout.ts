// Declarative item sheet layouts.
//
// A layout is a JSON document describing how an item's structured data is laid
// out as a sheet: rows of sections, each holding fields bound to paths in the
// data. Derived values (e.g. how many stress boxes a character gets) use a
// small, safe expression language instead of code, so layouts can be stored
// in Archivium and rendered anywhere.
//
// This file is framework-free and shared verbatim between:
//   - fate.archivium.net: src/layout/core.ts
//   - archivium:          src/lib/sheetLayout.ts
// Keep the copies in sync.

/* Expressions */

export type Expr =
  | { const: number }
  | { path: string }                 // Numeric value at a path (missing -> 0)
  | { count: string }                // Length of the array / number of keys at a path
  | { add: Expr[] }
  | { sub: [Expr, Expr] }
  | { max: Expr[] }
  | { min: Expr[] }
  | { gte: [Expr, Expr] }            // 1 if a >= b, else 0
  // Piecewise lookup: the value of the first [threshold, value] pair whose
  // threshold the input meets (list thresholds highest first), else `else`.
  | { step: Expr, steps: [number, number][], else: number };

export function evaluate(expr: Expr, data: unknown): number {
  if ('const' in expr) return expr.const;
  if ('path' in expr) {
    const value = Number(getPath(data, expr.path));
    return Number.isFinite(value) ? value : 0;
  }
  if ('count' in expr) {
    const value = getPath(data, expr.count);
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return 0;
  }
  if ('add' in expr) return expr.add.reduce((sum, e) => sum + evaluate(e, data), 0);
  if ('sub' in expr) return evaluate(expr.sub[0], data) - evaluate(expr.sub[1], data);
  if ('max' in expr) return Math.max(...expr.max.map(e => evaluate(e, data)));
  if ('min' in expr) return Math.min(...expr.min.map(e => evaluate(e, data)));
  if ('gte' in expr) return evaluate(expr.gte[0], data) >= evaluate(expr.gte[1], data) ? 1 : 0;
  if ('step' in expr) {
    const value = evaluate(expr.step, data);
    for (const [threshold, result] of expr.steps) {
      if (value >= threshold) return result;
    }
    return expr.else;
  }
  return 0;
}

/* Data paths */

// Paths are dot-separated keys relative to the sheet's data root, e.g. 'stress.physical'.
export function getPath(data: unknown, path: string): unknown {
  let current: unknown = data;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// Returns a copy of `data` with the value at `path` replaced.
export function setPath<T>(data: T, path: string, value: unknown): T {
  const [key, ...rest] = path.split('.');
  const source = (data !== null && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const copy = (Array.isArray(source) ? [...source] : { ...source }) as Record<string, unknown>;
  copy[key] = rest.length > 0 ? setPath(source[key], rest.join('.'), value) : value;
  return copy as T;
}

export function textAt(data: unknown, path: string): string {
  const value = getPath(data, path);
  return typeof value === 'string' ? value : '';
}

/* Layout schema */

export type TitleField = { widget: 'title', caption?: string };
export type TextField = { widget: 'text', path: string, caption?: string, label?: string, multiline?: boolean, rows?: number };
export type NumberField = { widget: 'number', path: string, label: string, default?: Expr, min?: number };
export type ComputedField = { widget: 'computed', label: string, value: Expr };
export type TextListField = { widget: 'textList', path: string, label: string, count: number };
export type EntryListField = {
  widget: 'entryList',
  path: string,
  itemLabel: string,
  addLabel: string,
  fields: { key: string, placeholder: string, multiline?: boolean }[],
};
// A map of option -> rating, shown as a ladder: one row per rating.
export type RatingLadderField = {
  widget: 'ratingLadder',
  path: string,
  options: string[],
  ratings: { value: number, label: string }[],
  // 'pyramid': each rating may hold no more entries than the one below it.
  rule?: 'pyramid',
};
// A row of numbered checkboxes, stored as a boolean array.
export type CheckTrackField = { widget: 'checkTrack', path: string, label: string, boxes: number, available?: Expr, lockedHint?: string };
// A single labeled text slot with a badge, e.g. a consequence.
export type SlotField = { widget: 'slot', path: string, badge: string, label: string, enabled?: Expr, lockedHint?: string };

export type SheetField =
  | TitleField
  | TextField
  | NumberField
  | ComputedField
  | TextListField
  | EntryListField
  | RatingLadderField
  | CheckTrackField
  | SlotField;

export type SheetSection = {
  title: string,
  fields: SheetField[],
  // 'stat' sections are small boxes holding a single prominent value.
  variant?: 'stat',
  grow?: number,
  basis?: string,
};

export type SheetRow = { sections: SheetSection[] };

// Sheet-level advice: `message` is shown whenever `unless` evaluates to 0.
export type SheetCheck = { unless: Expr, message: string };

export type SheetLayout = {
  version: 1,
  id: string,
  // Shown as the tab name.
  title: string,
  // The item obj_data key holding this sheet's data.
  root: string,
  rows: SheetRow[],
  checks?: SheetCheck[],
};

// Stored on a universe as obj_data.sheets.
export type SheetsConfig = {
  layouts: { [id: string]: SheetLayout },
  // Item category shortname -> layout id.
  categories: { [category: string]: string },
};

export function layoutForCategory(universeObjData: unknown, category: string): SheetLayout | null {
  const sheets = getPath(universeObjData, 'sheets') as Partial<SheetsConfig> | undefined;
  const id = sheets?.categories?.[category];
  return (id && sheets?.layouts?.[id]) || null;
}

/* Widget helpers, shared by all renderers */

export function sectionFlex(section: SheetSection): string {
  if (section.variant === 'stat') return `${section.grow ?? 0} 0 ${section.basis ?? 'auto'}`;
  return `${section.grow ?? 1} 1 ${section.basis ?? '22rem'}`;
}

export function isEnabled(expr: Expr | undefined, data: unknown): boolean {
  return expr === undefined || evaluate(expr, data) !== 0;
}

export function numberValue(field: NumberField, data: unknown): number {
  const value = getPath(data, field.path);
  if (typeof value === 'number') return value;
  return field.default ? evaluate(field.default, data) : 0;
}

export function textListValues(field: TextListField, data: unknown): string[] {
  const value = getPath(data, field.path);
  const values = Array.isArray(value) ? value.map(v => typeof v === 'string' ? v : '') : [];
  while (values.length < field.count) values.push('');
  return values;
}

export function entryListValues(field: EntryListField, data: unknown): Record<string, string>[] {
  const value = getPath(data, field.path);
  return Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : [];
}

export function ladderRatings(field: RatingLadderField, data: unknown): { [option: string]: number } {
  const value = getPath(data, field.path);
  const ratings: { [option: string]: number } = {};
  if (value && typeof value === 'object') {
    for (const [option, rating] of Object.entries(value)) {
      if (typeof rating === 'number' && rating !== 0) ratings[option] = rating;
    }
  }
  return ratings;
}

export function ladderRows(field: RatingLadderField, data: unknown): { value: number, label: string, entries: string[] }[] {
  const ratings = ladderRatings(field, data);
  return field.ratings.map(({ value, label }) => ({
    value,
    label,
    entries: Object.keys(ratings).filter(option => ratings[option] === value).sort(),
  }));
}

export function trackBoxes(field: CheckTrackField, data: unknown): { checked: boolean, enabled: boolean }[] {
  const value = getPath(data, field.path);
  const checked = Array.isArray(value) ? value : [];
  const available = field.available ? evaluate(field.available, data) : field.boxes;
  return Array.from({ length: field.boxes }, (_, i) => ({
    enabled: i < available,
    checked: i < available && checked[i] === true,
  }));
}

/* Validation */

function fieldProblems(field: SheetField, data: unknown): string[] {
  if (field.widget !== 'ratingLadder' || field.rule !== 'pyramid') return [];
  const problems: string[] = [];
  const rows = ladderRows(field, data);
  // Only check from the highest occupied rating down.
  const top = rows.findIndex(row => row.entries.length > 0);
  if (top < 0) return problems;
  for (let i = top; i < rows.length - 1; i++) {
    const above = rows[i];
    const below = rows[i + 1];
    if (above.entries.length > below.entries.length) {
      problems.push(`${above.entries.length} at ${above.label} but only ${below.entries.length} at ${below.label}.`);
    }
  }
  return problems;
}

// Advisory problems with the data; renderers show them but never block saving.
export function validateSheet(layout: SheetLayout, data: unknown): string[] {
  const problems: string[] = [];
  for (const row of layout.rows) {
    for (const section of row.sections) {
      for (const field of section.fields) {
        problems.push(...fieldProblems(field, data).map(problem => `${section.title}: ${problem}`));
      }
    }
  }
  for (const check of layout.checks ?? []) {
    if (evaluate(check.unless, data) === 0) problems.push(check.message);
  }
  return problems;
}

/* Read-only view model, for renderers that can't evaluate layouts themselves (e.g. templates) */

export type FieldView =
  | { widget: 'title', value: string, caption?: string }
  | { widget: 'text', value: string, caption?: string, label?: string, multiline: boolean }
  | { widget: 'number' | 'computed', value: number, label: string }
  | { widget: 'textList', label: string, values: string[] }
  | { widget: 'entryList', itemLabel: string, entries: { value: string, multiline: boolean }[][] }
  | { widget: 'ratingLadder', rows: { label: string, entries: string[] }[] }
  | { widget: 'checkTrack', label: string, boxes: { number: number, checked: boolean, enabled: boolean }[], lockedHint?: string }
  | { widget: 'slot', badge: string, label: string, value: string, enabled: boolean, lockedHint?: string };

export type SheetView = {
  title: string,
  problems: string[],
  rows: { sections: { title: string, variant?: 'stat', flex: string, fields: FieldView[] }[] }[],
};

function buildFieldView(field: SheetField, data: unknown, itemTitle: string): FieldView {
  switch (field.widget) {
    case 'title':
      return { widget: 'title', value: itemTitle, caption: field.caption };
    case 'text':
      return { widget: 'text', value: textAt(data, field.path), caption: field.caption, label: field.label, multiline: field.multiline ?? false };
    case 'number':
      return { widget: 'number', value: numberValue(field, data), label: field.label };
    case 'computed':
      return { widget: 'computed', value: evaluate(field.value, data), label: field.label };
    case 'textList':
      return { widget: 'textList', label: field.label, values: textListValues(field, data) };
    case 'entryList':
      return {
        widget: 'entryList',
        itemLabel: field.itemLabel,
        entries: entryListValues(field, data).map(entry => field.fields.map(({ key, multiline }) => ({
          value: typeof entry[key] === 'string' ? entry[key] : '',
          multiline: multiline ?? false,
        }))),
      };
    case 'ratingLadder':
      return { widget: 'ratingLadder', rows: ladderRows(field, data).map(({ label, entries }) => ({ label, entries })) };
    case 'checkTrack':
      return {
        widget: 'checkTrack',
        label: field.label,
        boxes: trackBoxes(field, data).map((box, i) => ({ ...box, number: i + 1 })),
        lockedHint: field.lockedHint,
      };
    case 'slot':
      return {
        widget: 'slot',
        badge: field.badge,
        label: field.label,
        value: textAt(data, field.path),
        enabled: isEnabled(field.enabled, data),
        lockedHint: field.lockedHint,
      };
  }
}

export function buildSheetView(layout: SheetLayout, data: unknown, itemTitle: string): SheetView {
  return {
    title: layout.title,
    problems: validateSheet(layout, data),
    rows: layout.rows.map(row => ({
      sections: row.sections.map(section => ({
        title: section.title,
        variant: section.variant,
        flex: sectionFlex(section),
        fields: section.fields.map(field => buildFieldView(field, data, itemTitle)),
      })),
    })),
  };
}
