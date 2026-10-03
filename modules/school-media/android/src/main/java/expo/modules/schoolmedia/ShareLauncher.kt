package expo.modules.schoolmedia

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import java.io.File

object ShareLauncher {
  const val RESULT_APP = "app"
  const val RESULT_CHOOSER = "chooser"

  fun authority(context: Context): String = "${context.packageName}.schoolmedia.fileprovider"

  fun isInstalled(context: Context, packageName: String): Boolean {
    return try {
      val packageManager = context.packageManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
      } else {
        @Suppress("DEPRECATION")
        packageManager.getPackageInfo(packageName, 0)
      }
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }
  }

  /**
   * Opens the chosen app with the files attached. Falls back to the system share sheet when that
   * app is not installed or does not accept this kind of file, and reports which one was shown.
   */
  fun share(
    context: Context,
    startedFromActivity: Boolean,
    uris: List<String>,
    mimeType: String,
    packageName: String?,
    chooserTitle: String
  ): String {
    require(uris.isNotEmpty()) { "Nothing was selected to share." }
    val intent = buildSendIntent(uris.map { toShareableUri(context, it) }, mimeType)
    if (!startedFromActivity) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    if (packageName != null && isInstalled(context, packageName)) {
      intent.setPackage(packageName)
      try {
        context.startActivity(intent)
        return RESULT_APP
      } catch (e: ActivityNotFoundException) {
        intent.setPackage(null)
      }
    }

    val chooser = Intent.createChooser(intent, chooserTitle)
    if (!startedFromActivity) {
      chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(chooser)
    return RESULT_CHOOSER
  }

  private fun buildSendIntent(contentUris: List<Uri>, mimeType: String): Intent {
    val intent = if (contentUris.size == 1) {
      Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, contentUris[0])
    } else {
      Intent(Intent.ACTION_SEND_MULTIPLE)
        .putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(contentUris))
    }
    intent.type = mimeType
    // The receiving app reads every attached file through these temporary read grants.
    val clipData = ClipData.newRawUri("", contentUris[0])
    contentUris.drop(1).forEach { clipData.addItem(ClipData.Item(it)) }
    intent.clipData = clipData
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    return intent
  }

  // Gallery items already have content URIs; files the app wrote itself are served by its FileProvider.
  private fun toShareableUri(context: Context, value: String): Uri {
    val uri = Uri.parse(value)
    return when (uri.scheme) {
      "content" -> uri
      "file", null -> FileProvider.getUriForFile(context, authority(context), File(uri.path ?: value))
      else -> throw IllegalArgumentException("Unsupported file location: $value")
    }
  }
}
