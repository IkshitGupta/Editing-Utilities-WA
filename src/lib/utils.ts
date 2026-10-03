import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Lets a "please wait" message reach the screen before heavy work blocks the JavaScript thread.
export function waitForPaint() {
  return new Promise<void>((resolve) => setTimeout(resolve, 80));
}
