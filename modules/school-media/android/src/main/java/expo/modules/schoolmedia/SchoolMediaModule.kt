package expo.modules.schoolmedia

import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

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

    AsyncFunction("getVideoInfo") { uri: String ->
      readVideoInfo(uri)
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

  private fun readVideoInfo(uri: String): Map<String, Any> {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, Uri.parse(uri))
      val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      val hasAudio = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO) == "yes"
      val (displayWidth, displayHeight) = RenderMath.displaySize(width, height, rotation)
      return mapOf(
        "width" to displayWidth,
        "height" to displayHeight,
        "durationMs" to durationMs.toDouble(),
        "hasAudio" to hasAudio
      )
    } finally {
      runCatching { retriever.release() }
    }
  }

  companion object {
    private const val PROGRESS_EVENT = "onRenderProgress"
  }
}
