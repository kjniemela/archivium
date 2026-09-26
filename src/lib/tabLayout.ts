/** For doing **numerical** logic on item data */
export type Expr =
  | { const: number }
  | { path: string }
  | { count: string }
  | { add: Expr[] }
  | { sub: [Expr, Expr] }
  | { max: Expr[] }
  | { min: Expr[] }
  | { gte: [Expr, Expr] }
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

export function getPath(data: unknown, path: string): unknown {
  let current: unknown = data;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Does not mutate, returns a modified copy. */
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

// TODO this is some bespoke FATE stuff, should probably generalize this a bit better...
export type RatingLadderField = {
  widget: 'ratingLadder',
  path: string,
  options: string[],
  ratings: { value: number, label: string }[],
  // 'pyramid': each rating may hold no more entries than the one below it.
  rule?: 'pyramid',
};

export type CheckTrackField = { widget: 'checkTrack', path: string, label: string, boxes: number, available?: Expr, lockedHint?: string };
export type SlotField = { widget: 'slot', path: string, badge: string, label: string, enabled?: Expr, lockedHint?: string };

export type LayoutField =
  | TitleField
  | TextField
  | NumberField
  | ComputedField
  | TextListField
  | EntryListField
  | RatingLadderField
  | CheckTrackField
  | SlotField;

export type LayoutSection = {
  title: string,
  fields: LayoutField[],
  variant?: 'stat', // TODO this specifies rendering style, we might either expand the possible options here or generalize further...
  grow?: number,
  basis?: string,
};

export type LayoutRow = { sections: LayoutSection[] };

/** `message` is rendered within the layout whenever `unless` evaluates to 0 */
export type LayoutCheck = { unless: Expr, message: string };

export type TabLayout = {
  version: 1,
  id: string,
  title: string,
  rows: LayoutRow[],
  checks?: LayoutCheck[],
};


/* Layout validation */
const isObject = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

function exprProblems(expr: unknown, where: string): string[] {
  if (!isObject(expr)) return [`${where}: expression must be an object.`];
  const operands = (key: string, arity?: number): string[] => {
    const args = expr[key];
    if (!Array.isArray(args) || (arity !== undefined && args.length !== arity)) {
      return [`${where}: "${key}" needs ${arity === undefined ? 'a list of' : arity} expressions.`];
    }
    return args.flatMap((arg, i) => exprProblems(arg, `${where}.${key}[${i}]`));
  };
  if ('const' in expr) return typeof expr.const === 'number' ? [] : [`${where}: "const" must be a number.`];
  if ('path' in expr) return typeof expr.path === 'string' ? [] : [`${where}: "path" must be a string.`];
  if ('count' in expr) return typeof expr.count === 'string' ? [] : [`${where}: "count" must be a string.`];
  if ('add' in expr) return operands('add');
  if ('max' in expr) return operands('max');
  if ('min' in expr) return operands('min');
  if ('sub' in expr) return operands('sub', 2);
  if ('gte' in expr) return operands('gte', 2);
  if ('step' in expr) {
    const problems = exprProblems(expr.step, `${where}.step`);
    const steps = expr.steps;
    if (!Array.isArray(steps) || !steps.every(s => Array.isArray(s) && s.length === 2 && s.every(n => typeof n === 'number'))) {
      problems.push(`${where}: "steps" must be a list of [threshold, value] number pairs.`);
    }
    if (typeof expr.else !== 'number') problems.push(`${where}: "else" must be a number.`);
    return problems;
  }
  return [`${where}: unknown expression.`];
}

const FIELD_REQUIREMENTS: { [widget in LayoutField['widget']]: { strings?: string[], numbers?: string[], exprs?: string[], optionalExprs?: string[] } } = {
  title: {},
  text: { strings: ['path'] },
  number: { strings: ['path', 'label'], optionalExprs: ['default'] },
  computed: { strings: ['label'], exprs: ['value'] },
  textList: { strings: ['path', 'label'], numbers: ['count'] },
  entryList: { strings: ['path', 'itemLabel', 'addLabel'] },
  ratingLadder: { strings: ['path'] },
  checkTrack: { strings: ['path', 'label'], numbers: ['boxes'], optionalExprs: ['available'] },
  slot: { strings: ['path', 'badge', 'label'], optionalExprs: ['enabled'] },
};

function layoutFieldProblems(field: unknown, where: string): string[] {
  if (!isObject(field)) return [`${where}: field must be an object.`];
  const widget = field.widget as LayoutField['widget'];
  const requirements = FIELD_REQUIREMENTS[widget];
  if (!requirements) return [`${where}: unknown widget "${String(field.widget)}".`];
  where = `${where} (${widget})`;
  const problems: string[] = [];
  for (const key of requirements.strings ?? []) {
    if (typeof field[key] !== 'string') problems.push(`${where}: "${key}" must be a string.`);
  }
  for (const key of requirements.numbers ?? []) {
    if (typeof field[key] !== 'number') problems.push(`${where}: "${key}" must be a number.`);
  }
  for (const key of requirements.exprs ?? []) problems.push(...exprProblems(field[key], `${where}.${key}`));
  for (const key of requirements.optionalExprs ?? []) {
    if (field[key] !== undefined) problems.push(...exprProblems(field[key], `${where}.${key}`));
  }
  if (widget === 'entryList') {
    const fields = field.fields;
    if (!Array.isArray(fields) || !fields.every(f => isObject(f) && typeof f.key === 'string' && typeof f.placeholder === 'string')) {
      problems.push(`${where}: "fields" must be a list of { key, placeholder } objects.`);
    }
  }
  if (widget === 'ratingLadder') {
    if (!Array.isArray(field.options) || !field.options.every(o => typeof o === 'string')) {
      problems.push(`${where}: "options" must be a list of strings.`);
    }
    const ratings = field.ratings;
    if (!Array.isArray(ratings) || !ratings.every(r => isObject(r) && typeof r.value === 'number' && typeof r.label === 'string')) {
      problems.push(`${where}: "ratings" must be a list of { value, label } objects.`);
    }
  }
  return problems;
}

/** @returns a list of structural problems that would stop a layout from rendering */
export function validateLayout(layout: unknown): string[] {
  if (!isObject(layout)) return ['Layout must be a JSON object.'];
  const problems: string[] = [];
  if (layout.version !== 1) problems.push('"version" must be 1.');
  for (const key of ['id', 'title']) {
    if (typeof layout[key] !== 'string' || !layout[key]) problems.push(`"${key}" must be a non-empty string.`);
  }
  if (layout.root !== undefined && typeof layout.root !== 'string') problems.push('"root" must be a string.');
  if (!Array.isArray(layout.rows)) {
    problems.push('"rows" must be a list.');
  } else {
    layout.rows.forEach((row, i) => {
      if (!isObject(row) || !Array.isArray(row.sections)) {
        problems.push(`rows[${i}]: "sections" must be a list.`);
        return;
      }
      row.sections.forEach((section, j) => {
        const where = `rows[${i}].sections[${j}]`;
        if (!isObject(section) || typeof section.title !== 'string' || !Array.isArray(section.fields)) {
          problems.push(`${where}: sections need a "title" and a list of "fields".`);
          return;
        }
        section.fields.forEach((field, k) => problems.push(...layoutFieldProblems(field, `${where}.fields[${k}]`)));
      });
    });
  }
  if (layout.checks !== undefined) {
    if (!Array.isArray(layout.checks)) {
      problems.push('"checks" must be a list.');
    } else {
      layout.checks.forEach((check, i) => {
        if (!isObject(check) || typeof check.message !== 'string') problems.push(`checks[${i}]: "message" must be a string.`);
        else problems.push(...exprProblems(check.unless, `checks[${i}].unless`));
      });
    }
  }
  return problems;
}


/* Widget helpers, shared by all renderers */
export function sectionFlex(section: LayoutSection): string {
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
function fieldProblems(field: LayoutField, data: unknown): string[] {
  if (field.widget !== 'ratingLadder' || field.rule !== 'pyramid') return [];
  const problems: string[] = [];
  const rows = ladderRows(field, data);
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

/** @returns a list of advisory problems with the data; renderers show them but never block saving */
export function validateLayoutData(layout: TabLayout, data: unknown): string[] {
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


/* Read-only view model */
export type FieldView =
  | { widget: 'title', value: string, caption?: string }
  | { widget: 'text', value: string, caption?: string, label?: string, multiline: boolean }
  | { widget: 'number' | 'computed', value: number, label: string }
  | { widget: 'textList', label: string, values: string[] }
  | { widget: 'entryList', itemLabel: string, entries: { value: string, multiline: boolean }[][] }
  | { widget: 'ratingLadder', rows: { label: string, entries: string[] }[] }
  | { widget: 'checkTrack', label: string, boxes: { number: number, checked: boolean, enabled: boolean }[], lockedHint?: string }
  | { widget: 'slot', badge: string, label: string, value: string, enabled: boolean, lockedHint?: string };

export type LayoutView = {
  title: string,
  problems: string[],
  rows: { sections: { title: string, variant?: 'stat', flex: string, fields: FieldView[] }[] }[],
};

function buildFieldView(field: LayoutField, data: unknown, itemTitle: string): FieldView {
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

export function buildLayoutView(layout: TabLayout, data: unknown, itemTitle: string): LayoutView {
  return {
    title: layout.title,
    problems: validateLayoutData(layout, data),
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
