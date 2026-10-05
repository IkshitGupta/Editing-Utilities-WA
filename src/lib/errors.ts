const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

// Native modules give the reason after a "Caused by:" marker, sometimes several times over.
const CAUSE_MARKER = '→ Caused by: ';

// Checks in the app's Kotlin code reach JavaScript with one of these class names in front.
const APP_CHECK_PREFIX = /^java\.lang\.Illegal(?:Argument|State)Exception:\s*/;

// Wording from Android libraries rather than from this app: module calls, Java class names, system
// error codes and status numbers, file paths and addresses such as content:// and https://.
const TECHNICAL_TEXT =
  /Call to function '|\b[a-z]\w*(?:\.[a-z]\w*)+\.[A-Z]\w*|Exception\b|\bE[A-Z]{2,}\b \(|\b0x[0-9a-fA-F]+\b|\/(?:data|storage|sdcard|mnt)\/|\b[a-z][\w+.-]*:\/\//;

// Mistakes in the app's own code, which say nothing useful to the person using it.
const SCRIPT_ERRORS = [TypeError, ReferenceError, RangeError, SyntaxError];

// Common causes, recognised in technical text. Access comes before a missing file, because Android
// reports both as a file that could not be opened.
const PLAIN_REASONS: readonly (readonly [RegExp, string])[] = [
  [
    /ENOSPC|No space left|not enough space|disk is full/i,
    "The phone's storage is full. Free up some space and try again.",
  ],
  [/OutOfMemory|out of memory/i, 'Not enough memory. Close other apps and try again.'],
  [
    /UnknownHost|Unable to resolve host|No address associated with hostname|ConnectException|SocketTimeout|SSLException|ENETUNREACH|Network is unreachable/i,
    'Could not connect to the internet. Check the connection and try again.',
  ],
  [
    /SecurityException|Permission denied|Operation not permitted|\bEACCES\b|\bEPERM\b/i,
    'The app does not have access to this file.',
  ],
  [/FileNotFound|ENOENT|No such file/i, 'The file could not be found.'],
];

// People see a short sentence in plain English: the app's own message, or the likely cause of a
// technical one. The full text goes to the log, where it helps with troubleshooting.
export function errorMessage(error: unknown): string {
  const raw = rawMessage(error);
  const message = SCRIPT_ERRORS.some((type) => error instanceof type)
    ? GENERIC_MESSAGE
    : readableMessage(raw);
  if (raw && message !== raw) {
    console.warn(raw);
  }
  return message;
}

function readableMessage(raw: string): string {
  if (TECHNICAL_TEXT.test(raw)) {
    const plain = PLAIN_REASONS.find(([pattern]) => pattern.test(raw));
    if (plain) {
      return plain[1];
    }
  }
  const reason = (raw.split(CAUSE_MARKER).pop() ?? '').trim().replace(APP_CHECK_PREFIX, '');
  return reason && !TECHNICAL_TEXT.test(reason) ? reason : GENERIC_MESSAGE;
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : '';
}

export function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as { code: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
