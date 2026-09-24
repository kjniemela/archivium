import type { BuiltinTab, ObjData } from '../api/models/item';
import { getPath, validateLayout, type SheetLayout } from './sheetLayout';

export const DEFAULT_TAB_KINDS = ['body', 'lineage', 'map', 'timeline', 'gallery'] as const;
export type DefaultTabKind = typeof DEFAULT_TAB_KINDS[number];

export type ItemTypeConfig = {
  defaultTabs?: DefaultTabKind[],
  customTabs?: string[],
  sheet?: string,
};

export type TypeConfigs = { [itemType: string]: ItemTypeConfig };

export function typeConfigFor(universeObjData: unknown, itemType: string): ItemTypeConfig {
  const config = getPath(universeObjData, 'typeConfigs') as TypeConfigs | undefined;
  const typeConfig = config?.[itemType];
  return typeConfig && typeof typeConfig === 'object' ? typeConfig : {};
}

export function sheetLayouts(universeObjData: unknown): { [id: string]: SheetLayout } {
  const layouts = getPath(universeObjData, 'sheets.layouts');
  return layouts && typeof layouts === 'object' ? layouts as { [id: string]: SheetLayout } : {};
}

// The sheet layout attached to an item type, or null if there is none or the
// stored layout is malformed (so a bad layout can't break item pages).
export function layoutForType(universeObjData: unknown, itemType: string): SheetLayout | null {
  const id = typeConfigFor(universeObjData, itemType).sheet;
  if (!id) return null;
  const layout = sheetLayouts(universeObjData)[id];
  if (!layout || validateLayout(layout).length > 0) return null;
  return layout;
}

function emptyTab(kind: DefaultTabKind): unknown {
  if (kind === 'body') return { text: '', structure: [] };
  // Built-in tabs only need a title to show up; their editors fill in the rest.
  return { title: kind.charAt(0).toUpperCase() + kind.slice(1) };
}

// Returns obj_data with any of the type's default tabs that are missing added.
// Existing tabs and data are never touched.
export function withDefaultTabs(objData: ObjData, universeObjData: unknown, itemType: string): ObjData {
  const config = typeConfigFor(universeObjData, itemType);
  const result: ObjData = { ...objData };
  for (const kind of config.defaultTabs ?? []) {
    if (!DEFAULT_TAB_KINDS.includes(kind) || result[kind] !== undefined) continue;
    if (kind === 'body') result.body = emptyTab(kind) as ObjData['body'];
    else result[kind as BuiltinTab] = emptyTab(kind);
  }
  for (const name of config.customTabs ?? []) {
    if (!name || result.tabs?.[name] !== undefined) continue;
    result.tabs = { ...result.tabs, [name]: {} };
  }
  const layout = layoutForType(universeObjData, itemType);
  if (layout && result[layout.root as keyof ObjData] === undefined) {
    (result as Record<string, unknown>)[layout.root] = {};
  }
  return result;
}

// The type's default tabs that obj_data doesn't have yet, e.g. after the item's type was changed.
export function missingDefaultTabs(objData: ObjData, universeObjData: unknown, itemType: string): string[] {
  const config = typeConfigFor(universeObjData, itemType);
  return [
    ...(config.defaultTabs ?? []).filter(kind => DEFAULT_TAB_KINDS.includes(kind) && objData[kind] === undefined),
    ...(config.customTabs ?? []).filter(name => name && objData.tabs?.[name] === undefined),
  ];
}

// Problems with a universe's type configs and sheet layouts that should stop it from being saved.
export function typeConfigProblems(universeObjData: unknown): string[] {
  const problems: string[] = [];
  const layouts = sheetLayouts(universeObjData);
  for (const [id, layout] of Object.entries(layouts)) {
    const layoutProblems = validateLayout(layout);
    problems.push(...layoutProblems.map(problem => `Sheet layout "${id}": ${problem}`));
    if (layoutProblems.length === 0 && layout.id !== id) problems.push(`Sheet layout "${id}": "id" must match its key.`);
  }
  const configs = (getPath(universeObjData, 'typeConfigs') ?? {}) as TypeConfigs;
  for (const [type, config] of Object.entries(configs)) {
    if (!config || typeof config !== 'object') {
      problems.push(`Item type "${type}": config must be an object.`);
      continue;
    }
    if (config.defaultTabs !== undefined && !(Array.isArray(config.defaultTabs) && config.defaultTabs.every(tab => DEFAULT_TAB_KINDS.includes(tab)))) {
      problems.push(`Item type "${type}": unknown default tab.`);
    }
    if (config.customTabs !== undefined && !(Array.isArray(config.customTabs) && config.customTabs.every(tab => typeof tab === 'string' && tab))) {
      problems.push(`Item type "${type}": custom tab names must be non-empty strings.`);
    }
    if (config.sheet !== undefined && !(config.sheet in layouts)) {
      problems.push(`Item type "${type}": sheet layout "${config.sheet}" doesn't exist.`);
    }
  }
  return problems;
}
