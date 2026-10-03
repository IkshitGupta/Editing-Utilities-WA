import { Directory, File, Paths } from 'expo-file-system';

export type OutputExtension = 'jpg' | 'png' | 'mp4';

function timestamp(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

// The file name becomes the photo's name in the gallery, so it starts with the school's name.
export function outputFile(folder: string, extension: OutputExtension): File {
  const directory = new Directory(Paths.cache, folder);
  directory.create({ intermediates: true, idempotent: true });
  const suffix = Math.random().toString(36).slice(2, 6);
  return new File(directory, `walnut-academy-${timestamp(new Date())}-${suffix}.${extension}`);
}

export function writeBytes(file: File, bytes: Uint8Array): string {
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}

export function persistentFile(folder: string, name: string): File {
  const directory = new Directory(Paths.document, folder);
  directory.create({ intermediates: true, idempotent: true });
  return new File(directory, name);
}
