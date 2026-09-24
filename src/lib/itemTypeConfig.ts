import type { BuiltinTab, ObjData } from '../api/models/item';
import { getPath, validateLayout, type SheetLayout } from './sheetLayout';

export const DEFAULT_TAB_KINDS = ['body', 'lineage', 'map', 'timeline', 'gallery'] as const;
export type DefaultTabKind = typeof DEFAULT_TAB_KINDS[number];

export type ItemTypeConfig = {
  defaultTabs?: DefaultTabKind[],
  customTabs?: string[],
  tabTypes?: string[],
};

export type TypeConfigs = { [itemType: string]: ItemTypeConfig };

export type LayoutTabsData = { [tabTypeId: string]: unknown };

// Tab type ids key item data (obj_data.layoutTabs), so they're fixed once created.
export const TAB_TYPE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const LAYOUT_TAB_PREFIX = 'layout:';
export const layoutTabKey = (id: string) => `${LAYOUT_TAB_PREFIX}${id}`;
export const layoutTabId = (key: string) => key.startsWith(LAYOUT_TAB_PREFIX) ? key.slice(LAYOUT_TAB_PREFIX.length) : null;

export function typeConfigFor(universeObjData: unknown, itemType: string): ItemTypeConfig {
  const config = getPath(universeObjData, 'typeConfigs') as TypeConfigs | undefined;
  const typeConfig = config?.[itemType];
  return typeConfig && typeof typeConfig === 'object' ? typeConfig : {};
}

function storedTabTypes(universeObjData: unknown): { [id: string]: unknown } {
  const tabTypes = getPath(universeObjData, 'tabTypes');
  return tabTypes && typeof tabTypes === 'object' ? tabTypes as { [id: string]: unknown } : {};
}

// Malformed tab types are left out, so a bad layout can't break item pages.
export function tabTypesOf(universeObjData: unknown): { [id: string]: SheetLayout } {
  const result: { [id: string]: SheetLayout } = {};
  for (const [id, layout] of Object.entries(storedTabTypes(universeObjData))) {
    if (validateLayout(layout).length === 0 && (layout as SheetLayout).id === id) result[id] = layout as SheetLayout;
  }
  return result;
}

export function layoutTabsOf(objData: ObjData): LayoutTabsData {
  return objData.layoutTabs && typeof objData.layoutTabs === 'object' ? objData.layoutTabs : {};
}

// Data for deleted tab types stays on the item but isn't shown, so re-adding the type restores it.
export function itemLayoutTabs(objData: ObjData, universeObjData: unknown): { layout: SheetLayout, data: unknown }[] {
  const data = layoutTabsOf(objData);
  return Object.values(tabTypesOf(universeObjData))
    .filter(layout => data[layout.id] !== undefined)
    .map(layout => ({ layout, data: data[layout.id] }));
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
  const tabTypes = tabTypesOf(universeObjData);
  for (const id of config.tabTypes ?? []) {
    if (!(id in tabTypes) || layoutTabsOf(result)[id] !== undefined) continue;
    result.layoutTabs = { ...result.layoutTabs, [id]: {} };
  }
  return result;
}

// Built-in tabs are returned by kind, custom data tabs by name, and layout tabs by layoutTabKey(id).
export function missingDefaultTabs(objData: ObjData, universeObjData: unknown, itemType: string): string[] {
  const config = typeConfigFor(universeObjData, itemType);
  const tabTypes = tabTypesOf(universeObjData);
  const layoutTabs = layoutTabsOf(objData);
  return [
    ...(config.defaultTabs ?? []).filter(kind => DEFAULT_TAB_KINDS.includes(kind) && objData[kind] === undefined),
    ...(config.customTabs ?? []).filter(name => name && objData.tabs?.[name] === undefined),
    ...(config.tabTypes ?? []).filter(id => id in tabTypes && layoutTabs[id] === undefined).map(layoutTabKey),
  ];
}

// Problems with a universe's type configs and tab types that should stop it from being saved.
export function typeConfigProblems(universeObjData: unknown): string[] {
  const problems: string[] = [];
  const tabTypes = storedTabTypes(universeObjData);
  for (const [id, layout] of Object.entries(tabTypes)) {
    if (!TAB_TYPE_ID_PATTERN.test(id)) problems.push(`Tab type "${id}": ids may only contain lowercase letters, numbers and dashes.`);
    const layoutProblems = validateLayout(layout);
    problems.push(...layoutProblems.map(problem => `Tab type "${id}": ${problem}`));
    if (layoutProblems.length === 0 && (layout as SheetLayout).id !== id) problems.push(`Tab type "${id}": "id" must match its key.`);
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
    if (config.tabTypes !== undefined) {
      if (!Array.isArray(config.tabTypes)) problems.push(`Item type "${type}": "tabTypes" must be a list.`);
      else for (const id of config.tabTypes.filter(id => !(id in tabTypes))) problems.push(`Item type "${type}": tab type "${id}" doesn't exist.`);
    }
  }
  return problems;
}
