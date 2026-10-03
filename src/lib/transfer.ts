// Screens hand lists of photos and videos to each other through this in-memory map, because
// content URIs are long and awkward to pass as route parameters.
const transfers = new Map<string, unknown>();
let counter = 0;

const MAX_ENTRIES = 30;

export function putTransfer<T>(value: T): string {
  counter += 1;
  const id = `t${counter}-${Date.now().toString(36)}`;
  transfers.set(id, value);
  if (transfers.size > MAX_ENTRIES) {
    const oldest = transfers.keys().next().value;
    if (oldest !== undefined) {
      transfers.delete(oldest);
    }
  }
  return id;
}

export function readTransfer<T>(id: string | string[] | undefined): T | undefined {
  if (typeof id !== 'string') {
    return undefined;
  }
  return transfers.get(id) as T | undefined;
}
