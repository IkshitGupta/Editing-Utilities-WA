package expo.modules.schoolmedia

import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class SchoolMediaModule : Module() {
  private var renderer: VideoRenderer? = null

  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SchoolMedia")

    Events(PROGRESS_EVENT)

    Function("isAppInstalled") { packageName: String ->
      ShareLauncher.isInstalled(context, packageName)
    }

    // Changes when the app is installed again, but not when it's updated.
    Function("installationTime") {
      installationTime().toDouble()
    }

    AsyncFunction("getVideoInfo") { uri: String ->
      readVideoInfo(uri)
    }

    AsyncFunction("extractFrame") { uri: String, timeMs: Double ->
      extractFrame(uri, timeMs)
    }

    AsyncFunction("renderVideo") { spec: RenderSpec, promise: Promise ->
      if (renderer?.isRunning == true) {
        promise.reject("ERR_RENDER_BUSY", "Another video is still being saved.", null)
      } else {
        val newRenderer = VideoRenderer(context) { progress ->
          sendEvent(PROGRESS_EVENT, mapOf("progress" to progress))
        }
        renderer = newRenderer
        newRenderer.start(spec, object : VideoRenderer.Callbacks {
          override fun onCompleted(output: File, durationMs: Long) {
            promise.resolve(
              mapOf(
                "uri" to Uri.fromFile(output).toString(),
                "sizeBytes" to output.length().toDouble(),
                "durationMs" to durationMs.toDouble()
              )
            )
          }

          override fun onFailed(code: String, message: String, cause: Throwable?) {
            promise.reject(code, message, cause)
          }
        })
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cancelRender") {
      renderer?.cancel()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("shareFiles") { uris: List<String>, mimeType: String, packageName: String?, chooserTitle: String ->
      val activity = appContext.currentActivity
      ShareLauncher.share(activity ?: context, activity != null, uris, mimeType, packageName, chooserTitle)
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      val active = renderer
      Handler(Looper.getMainLooper()).post { active?.cancel() }
    }
  }

  private fun installationTime(): Long {
    val packageManager = context.packageManager
    val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
    } else {
      @Suppress("DEPRECATION")
      packageManager.getPackageInfo(context.packageName, 0)
    }
    return info.firstInstallTime
  }

  private fun readVideoInfo(uri: String): Map<String, Any> {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, Uri.parse(uri))
      val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      val hasAudio = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO) == "yes"
      val bitrate = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)?.toIntOrNull() ?: 0
      val (displayWidth, displayHeight) = RenderMath.displaySize(width, height, rotation)
      return mapOf(
        "width" to displayWidth,
        "height" to displayHeight,
        "durationMs" to durationMs.toDouble(),
        "hasAudio" to hasAudio,
        "bitrate" to bitrate,
        "codec" to videoCodec(uri)
      )
    } finally {
      runCatching { retriever.release() }
    }
  }

  // The video track's format, such as video/avc or video/hevc, or an empty string if unknown.
  private fun videoCodec(uri: String): String {
    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(context, Uri.parse(uri), null)
      (0 until extractor.trackCount)
        .mapNotNull { extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME) }
        .firstOrNull { it.startsWith("video/") }
        .orEmpty()
    } catch (e: Exception) {
      ""
    } finally {
      extractor.release()
    }
  }

  // A paused player shows the frame at or just after its position, so that frame is taken rather
  // than the nearest one, which can be the frame before. The caller removes the file once it has
  // read it.
  private fun extractFrame(uri: String, timeMs: Double): Map<String, Any> {
    val requestedUs = (timeMs * 1000).toLong().coerceAtLeast(0L)
    val frameUs = firstFrameAtOrAfter(uri, requestedUs) ?: requestedUs
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, Uri.parse(uri))
      val frame = readFrame(retriever, frameUs)
        ?: throw CodedException("ERR_FRAME_UNREADABLE", "This frame could not be read.", null)
      try {
        val folder = File(context.cacheDir, FRAME_FOLDER).apply { mkdirs() }
        val file = File(folder, "frame-${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { frame.compress(Bitmap.CompressFormat.JPEG, 100, it) }
        return mapOf(
          "uri" to Uri.fromFile(file).toString(),
          "width" to frame.width,
          "height" to frame.height
        )
      } finally {
        frame.recycle()
      }
    } finally {
      runCatching { retriever.release() }
    }
  }

  // Android returns frames in 16-bit colour unless asked otherwise, which shows bands in smooth
  // areas such as sky. Full colour can be asked for from Android 11.
  private fun readFrame(retriever: MediaMetadataRetriever, timeUs: Long): Bitmap? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val params = MediaMetadataRetriever.BitmapParams().apply {
        preferredConfig = Bitmap.Config.ARGB_8888
      }
      retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST, params)
    } else {
      retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST)
    }

  // The time of the first frame shown at or after the given time, or null if it can't be found.
  // Frames are stored in decoding order, which can differ from display order, so a few frames
  // past the first match are checked too.
  private fun firstFrameAtOrAfter(uri: String, timeUs: Long): Long? {
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(context, Uri.parse(uri), null)
      val track = (0 until extractor.trackCount).firstOrNull {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true
      } ?: return null
      extractor.selectTrack(track)
      extractor.seekTo(timeUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
      var found: Long? = null
      var matches = 0
      var read = 0
      while (matches < REORDER_WINDOW && read < MAX_FRAMES_READ) {
        val sampleUs = extractor.sampleTime
        if (sampleUs < 0) {
          break
        }
        if (sampleUs >= timeUs) {
          found = minOf(found ?: sampleUs, sampleUs)
          matches++
        }
        read++
        if (!extractor.advance()) {
          break
        }
      }
      return found
    } catch (e: Exception) {
      return null
    } finally {
      extractor.release()
    }
  }

  companion object {
    private const val PROGRESS_EVENT = "onRenderProgress"
    private const val FRAME_FOLDER = "video-frames"
    private const val REORDER_WINDOW = 8
    private const val MAX_FRAMES_READ = 1000
  }
}
