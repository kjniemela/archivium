// Bridges the Visual Builder form state to/from the raw CalendarDefinition JSON.
// Intentionally covers only the "basic" subset of the engine's features (fixed-duration
// cycles, single leap-rule-chain variable cycles, named-sequence subdivisions with an
// optional leap bonus, and independent cycles). Anything fancier (era comparisons,
// exceptions, arbitrary and/or/not nesting) has to be edited as raw JSON - see
// tryParseIntoBuilderState, which refuses to touch a definition it can't losslessly
// round-trip through this simplified shape.
import type { CalendarDefinition, CalendarFormat } from './calendars';

export type LeapRule = { divisor: number; equals: number; result: boolean };

export type BuilderUnit = {
  name: string;
  durationTicks: number;
  leapBonusTicks: number; // 0 = no leap dependence
};

export type BuilderCycle = {
  id: string;
  kind: 'fixed' | 'leap';
  durationTicks: number; // fixed: the duration; leap: the non-leap (base) duration
  leapBonusTicks: number; // leap only: added to durationTicks in a leap iteration
  leapRules: LeapRule[]; // leap only: evaluated in order, first match wins, else "not leap"
  subdivisions: BuilderUnit[]; // named_sequence units, optional (usually only on the largest cycle)
};

export type BuilderIndependentCycle = {
  id: string;
  durationTicks: number;
  period: number;
  names: string[];
};

// A date format is an ordered list of segments. Compiles to the engine's { str, keys } form:
// every field becomes a "%s" in str (two, for a field with an ordinal suffix) and pushes its key
// (plus "offset, add" / "width, zero_pad" / "ordinal_suff" operations, in that order) onto keys.
export type FormatSegment =
  | { kind: 'text'; text: string }
  | { kind: 'field'; key: string; offset: number; pad: number; ordinal: boolean }; // pad: zero-pad width, 0 = none

export type BuilderState = {
  name: string;
  epochTimestamp: number;
  cycles: BuilderCycle[];
  independentCycles: BuilderIndependentCycle[];
  format: FormatSegment[]; // empty = no format (decoded dates show as raw JSON)
};

export function blankBuilderState(): BuilderState {
  return {
    name: 'New Calendar',
    epochTimestamp: 0,
    cycles: [{ id: 'day', kind: 'fixed', durationTicks: 1, leapBonusTicks: 0, leapRules: [], subdivisions: [] }],
    independentCycles: [],
    format: [],
  };
}

export type FormatField = { key: string; label: string; numeric: boolean };

// The data keys CalendarSystem.timestampToCalendar will actually produce for this builder state.
// `numeric` is false for name-valued fields, where an offset or ordinal suffix makes no sense.
export function availableFormatFields(state: BuilderState): FormatField[] {
  const fields: FormatField[] = [];
  for (const c of state.cycles) {
    fields.push({ key: c.id, label: c.id, numeric: true });
    if (c.kind === 'leap' && c.subdivisions.length) {
      fields.push({ key: `${c.id}_subdivision`, label: `${c.id}_subdivision (name)`, numeric: false });
      fields.push({ key: `${c.id}_subdivision_index`, label: `${c.id}_subdivision_index`, numeric: true });
    }
  }
  for (const ic of state.independentCycles) {
    const named = ic.names.some(Boolean);
    fields.push({ key: ic.id, label: named ? `${ic.id} (name)` : ic.id, numeric: !named });
  }
  return fields;
}

export function compileFormat(segments: FormatSegment[]): CalendarFormat | undefined {
  if (!segments.length) return undefined;
  let str = '';
  const keys: (string | number)[] = [];
  for (const seg of segments) {
    if (seg.kind === 'text') {
      str += seg.text;
      continue;
    }
    keys.push(seg.key);
    if (seg.offset) keys.push(seg.offset, 'add');
    if (seg.pad) keys.push(seg.pad, 'zero_pad');
    str += '%s';
    if (seg.ordinal) {
      keys.push('ordinal_suff');
      str += '%s';
    }
  }
  return { str, keys };
}

// Inverse of compileFormat. Returns null for formats it can't represent (literal-number keys
// outside an offset, an ordinal suffix separated from its number, mismatched placeholder counts).
export function parseFormat(format: CalendarFormat): FormatSegment[] | null {
  if (!format || typeof format.str !== 'string' || !Array.isArray(format.keys)) return null;

  type Item = { kind: 'field'; key: string; offset: number; pad: number; ordinal: boolean } | { kind: 'num'; n: number };
  const items: Item[] = [];
  for (const k of format.keys) {
    if (k === 'add') {
      const b = items.pop();
      const a = items.pop();
      if (!a || !b || a.kind !== 'field' || a.ordinal || a.pad !== 0 || a.offset !== 0 || b.kind !== 'num') return null;
      a.offset = b.n;
      items.push(a);
    } else if (k === 'zero_pad') {
      const b = items.pop();
      const a = items.pop();
      if (!a || !b || a.kind !== 'field' || a.ordinal || a.pad !== 0 || b.kind !== 'num' || b.n <= 0) return null;
      a.pad = b.n;
      items.push(a);
    } else if (k === 'ordinal_suff') {
      const last = items[items.length - 1];
      if (!last || last.kind !== 'field' || last.ordinal) return null;
      last.ordinal = true;
    } else if (typeof k === 'number') {
      items.push({ kind: 'num', n: k });
    } else {
      items.push({ kind: 'field', key: k, offset: 0, pad: 0, ordinal: false });
    }
  }

  const parts = format.str.split('%s'); // parts[i] is the text after the i-th placeholder
  const segments: FormatSegment[] = [];
  const pushText = (text: string) => { if (text) segments.push({ kind: 'text', text }); };

  pushText(parts[0]);
  let p = 1;
  for (const item of items) {
    if (item.kind !== 'field') return null;
    segments.push({ kind: 'field', key: item.key, offset: item.offset, pad: item.pad, ordinal: item.ordinal });
    if (item.ordinal) {
      if (parts[p] !== '') return null; // suffix must directly follow its number
      p++;
    }
    if (p >= parts.length) return null;
    pushText(parts[p]);
    p++;
  }
  if (p !== parts.length) return null; // placeholders left over with no value

  return segments;
}

function leapFunctionName(cycleId: string) {
  return `is_leap_${cycleId}`;
}

function leapCondition(cycleId: string) {
  return {
    type: 'function_call',
    function: leapFunctionName(cycleId),
    args: [{ type: 'variable', name: 'year_index' }],
  };
}

export function buildDefinition(state: BuilderState): CalendarDefinition {
  const functions: { [name: string]: any } = {};

  const cycles = state.cycles.map(c => {
    if (c.kind === 'fixed') {
      return { id: c.id, duration_ticks: c.durationTicks };
    }

    functions[leapFunctionName(c.id)] = {
      type: 'leap_year',
      rules: c.leapRules.map(r => ({
        condition: { type: 'modulo', divisor: r.divisor, equals: r.equals },
        value: { type: 'variable', name: 'year_index' },
        result: r.result,
      })),
    };

    const cond = leapCondition(c.id);
    const cycle: any = {
      id: c.id,
      estimated_duration_ticks: c.durationTicks,
      duration_fn: {
        type: 'conditional',
        variable: 'year_index',
        conditions: [
          { if: cond, duration_ticks: c.durationTicks + c.leapBonusTicks },
          { default: true, duration_ticks: c.durationTicks },
        ],
      },
    };

    if (c.subdivisions.length) {
      cycle.subdivisions = [{
        type: 'named_sequence',
        units: c.subdivisions.map(u => {
          if (u.leapBonusTicks) {
            return {
              name: u.name,
              duration_fn: {
                type: 'expression',
                operator: 'ternary',
                condition: cond,
                true_value: u.durationTicks + u.leapBonusTicks,
                false_value: u.durationTicks,
              },
            };
          }
          return { name: u.name, duration_ticks: u.durationTicks };
        }),
      }];
    }

    return cycle;
  });

  const def: CalendarDefinition = { name: state.name, epoch: { timestamp: state.epochTimestamp }, cycles };
  const format = compileFormat(state.format);
  if (format) def.format = format;
  if (Object.keys(functions).length) def.functions = functions;
  if (state.independentCycles.length) {
    // An empty names array isn't "no names" to the engine (it would index into it and get undefined),
    // so only emit the key when there's at least one real name.
    def.independent_cycles = state.independentCycles.map(ic => ({
      id: ic.id, duration_ticks: ic.durationTicks, period: ic.period,
      ...(ic.names.some(Boolean) ? { names: ic.names } : {}),
    }));
  }
  return def;
}

// Returns null if `def` uses anything outside the basic subset above - callers should
// fall back to raw JSON editing rather than risk silently dropping the unsupported parts.
export function tryParseIntoBuilderState(def: CalendarDefinition): BuilderState | null {
  if (!def || typeof def !== 'object' || !Array.isArray(def.cycles)) return null;

  const cycles: BuilderCycle[] = [];

  for (const cycle of def.cycles) {
    if (cycle.duration_ticks !== undefined && !cycle.duration_fn) {
      if (cycle.exceptions || cycle.subdivisions) return null; // fixed cycles aren't expected to have either
      cycles.push({ id: cycle.id, kind: 'fixed', durationTicks: cycle.duration_ticks, leapBonusTicks: 0, leapRules: [], subdivisions: [] });
      continue;
    }

    if (cycle.exceptions) return null;
    const leap = parseLeapCycle(cycle, def.functions ?? {});
    if (!leap) return null;
    cycles.push(leap);
  }

  const independentCycles: BuilderIndependentCycle[] = [];
  for (const ic of def.independent_cycles ?? []) {
    if (typeof ic.duration_ticks !== 'number' || typeof ic.period !== 'number') return null;
    independentCycles.push({ id: ic.id, durationTicks: ic.duration_ticks, period: ic.period, names: ic.names ?? [] });
  }

  const format = def.format ? parseFormat(def.format) : [];
  if (!format) return null;

  return {
    name: def.name ?? 'Calendar',
    epochTimestamp: def.epoch?.timestamp ?? 0,
    cycles,
    independentCycles,
    format,
  };
}

function parseLeapCycle(cycle: any, functions: { [name: string]: any }): BuilderCycle | null {
  const fn = cycle.duration_fn;
  if (!fn || fn.type !== 'conditional' || fn.variable !== 'year_index') return null;
  if (!Array.isArray(fn.conditions) || fn.conditions.length !== 2) return null;

  const [leapCond, defaultCond] = fn.conditions;
  if (!defaultCond.default) return null;
  if (!leapCond.if || leapCond.if.type !== 'function_call') return null;

  const funcName = leapCond.if.function;
  const funcDef = functions[funcName];
  if (!funcDef || funcDef.type !== 'leap_year') return null;

  const leapRules: LeapRule[] = [];
  for (const rule of funcDef.rules) {
    if (!rule.condition || rule.condition.type !== 'modulo') return null;
    if (rule.value?.type !== 'variable' || rule.value?.name !== 'year_index') return null;
    leapRules.push({ divisor: rule.condition.divisor, equals: rule.condition.equals, result: !!rule.result });
  }

  const durationTicks = defaultCond.duration_ticks;
  const leapBonusTicks = leapCond.duration_ticks - durationTicks;

  const subdivisions: BuilderUnit[] = [];
  if (cycle.subdivisions) {
    if (cycle.subdivisions.length !== 1 || cycle.subdivisions[0].type !== 'named_sequence') return null;
    for (const unit of cycle.subdivisions[0].units) {
      if (unit.duration_ticks !== undefined && !unit.duration_fn) {
        if (unit.exceptions) return null;
        subdivisions.push({ name: unit.name, durationTicks: unit.duration_ticks, leapBonusTicks: 0 });
        continue;
      }
      if (unit.exceptions) return null;
      const uf = unit.duration_fn;
      if (!uf || uf.type !== 'expression' || uf.operator !== 'ternary') return null;
      if (!uf.condition || uf.condition.type !== 'function_call' || uf.condition.function !== funcName) return null;
      subdivisions.push({ name: unit.name, durationTicks: uf.false_value, leapBonusTicks: uf.true_value - uf.false_value });
    }
  }

  return { id: cycle.id, kind: 'leap', durationTicks, leapBonusTicks, leapRules, subdivisions };
}
