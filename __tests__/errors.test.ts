import { errorMessage } from '@/lib/errors';

const GENERIC = 'Something went wrong. Please try again.';
const STORAGE_FULL = "The phone's storage is full. Free up some space and try again.";
const NO_ACCESS = 'The app does not have access to this file.';

describe('errorMessage', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('shows the app’s own messages unchanged', () => {
    const messages = [
      'This photo could not be opened.',
      'The file was saved but could not be found in the School Admin album.',
      'Allow access to photos and videos so the app can save to the School Admin album.',
      'Not enough memory to create this image.',
      'Another video is still being saved.',
      'The video could not be saved (ERROR_CODE_ENCODER_INIT_FAILED).',
      'The video could not be saved (ERROR_CODE_IO_FILE_NOT_FOUND).',
    ];
    for (const message of messages) {
      expect(errorMessage(new Error(message))).toBe(message);
    }
    expect(errorMessage('Saving was interrupted.')).toBe('Saving was interrupted.');
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps a plain message that names a common cause as it is', () => {
    const message = 'There is not enough space on this phone for the video.';
    expect(errorMessage(new Error(message))).toBe(message);
  });

  it('shows the reason a native module gives, without the call details', () => {
    expect(
      errorMessage(
        new Error(
          "Call to function 'SchoolMedia.extractFrame' has been rejected.\n→ Caused by: This frame could not be read."
        )
      )
    ).toBe('This frame could not be read.');
    expect(
      errorMessage(
        new Error(
          "Call to function 'SchoolMedia.share' has been rejected.\n→ Caused by: java.lang.IllegalArgumentException: Nothing was selected to share."
        )
      )
    ).toBe('Nothing was selected to share.');
    expect(
      errorMessage(
        new Error(
          "Call to function 'ExpoUpdates.checkForUpdateAsync' has been rejected.\n→ Caused by: Failed to check for update"
        )
      )
    ).toBe('Failed to check for update');
  });

  it('replaces a missing file with a plain reason and logs the details', () => {
    const raw =
      "Call to function 'ExpoImage.loadAsync' has been rejected.\n→ Caused by: Failed to load the image: com.bumptech.glide.load.engine.GlideException: Failed to load resource\nThere were 3 root causes:\njava.io.FileNotFoundException(/data/user/0/com.walnutacademy.admin/cache/ImagePicker/2ea501b8.jpeg: open failed: ENOENT (No such file or directory))";
    expect(errorMessage(new Error(raw))).toBe('The file could not be found.');
    expect(warn).toHaveBeenCalledWith(raw);
  });

  it.each([
    ['java.io.IOException: write failed: ENOSPC (No space left on device)', STORAGE_FULL],
    [
      'android.database.sqlite.SQLiteFullException: database or disk is full (code 13 SQLITE_FULL)',
      STORAGE_FULL,
    ],
    [
      'java.lang.OutOfMemoryError: Failed to allocate a 48000012 byte allocation with 4194304 free bytes',
      'Not enough memory. Close other apps and try again.',
    ],
    [
      'java.net.UnknownHostException: Unable to resolve host "example.com": No address associated with hostname',
      'Could not connect to the internet. Check the connection and try again.',
    ],
    [
      'java.lang.SecurityException: com.walnutacademy.admin has no access to content://media/external/images/media/12',
      NO_ACCESS,
    ],
    [
      'java.io.FileNotFoundException: /storage/emulated/0/Pictures/School Admin/photo.jpg: open failed: EACCES (Permission denied)',
      NO_ACCESS,
    ],
    [
      'java.io.FileNotFoundException: /storage/emulated/0/Pictures/School Admin/photo.jpg: open failed: EPERM (Operation not permitted)',
      NO_ACCESS,
    ],
  ])('gives a plain reason for %s', (raw, expected) => {
    expect(errorMessage(new Error(raw))).toBe(expected);
  });

  it('uses a general message for other technical text', () => {
    const samples = [
      "Call to function 'SchoolMedia.share' has been rejected.\n→ Caused by: android.content.ActivityNotFoundException: No Activity found to handle Intent { act=android.intent.action.SEND }",
      "Call to function 'SchoolMedia.extractFrame' has been rejected.\n→ Caused by: java.lang.RuntimeException: setDataSource failed: status = 0x80000000",
      'setDataSource failed: status = 0x80000000',
      'java.io.IOException: Broken pipe',
      'Unsupported file location: content://media/external/file/9',
      "Call to function 'ExpoImage.loadAsync' has been rejected.",
    ];
    for (const sample of samples) {
      expect(errorMessage(new Error(sample))).toBe(GENERIC);
    }
  });

  it('uses a general message for mistakes in the app’s own code and logs them', () => {
    const mistake = new TypeError("Cannot read property 'uri' of undefined");
    expect(errorMessage(mistake)).toBe(GENERIC);
    expect(warn).toHaveBeenCalledWith(mistake.message);
    expect(errorMessage(new RangeError('Invalid array length'))).toBe(GENERIC);
  });

  it('uses a general message when there is no text', () => {
    expect(errorMessage(new Error(''))).toBe(GENERIC);
    expect(errorMessage(undefined)).toBe(GENERIC);
    expect(errorMessage({ code: 'ERR_UNKNOWN' })).toBe(GENERIC);
    expect(warn).not.toHaveBeenCalled();
  });
});
