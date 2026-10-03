import { Storage } from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

import { DEFAULT_SETTINGS, parseSettings, type Settings } from './settings';

const STORAGE_KEY = 'settings.v1';

let cached: Settings | null = null;
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const raw = Storage.getItemSync(STORAGE_KEY);
    return parseSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function getSettings(): Settings {
  if (!cached) {
    cached = load();
  }
  return cached;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = parseSettings({ ...getSettings(), ...patch });
  Storage.setItemSync(STORAGE_KEY, JSON.stringify(next));
  cached = next;
  listeners.forEach((listener) => listener());
  return next;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
