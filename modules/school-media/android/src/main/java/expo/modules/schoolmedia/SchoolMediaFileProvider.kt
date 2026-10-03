package expo.modules.schoolmedia

import androidx.core.content.FileProvider

// A dedicated subclass keeps this provider separate from other libraries' providers when manifests merge.
class SchoolMediaFileProvider : FileProvider()
