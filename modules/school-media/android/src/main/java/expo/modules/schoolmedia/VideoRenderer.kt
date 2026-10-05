package expo.modules.schoolmedia

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.DefaultGainProvider
import androidx.media3.common.audio.GainProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.Crop
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.Presentation
import androidx.media3.effect.ScaleAndRotateTransformation
import androidx.media3.effect.TextureOverlay
import androidx.media3.transformer.AudioEncoderSettings
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import java.io.File

// Media3's Transformer must be created, started, polled and cancelled on the main thread,
// because it is bound to the looper of the thread that built it.
@OptIn(UnstableApi::class)
class VideoRenderer(
  private val context: Context,
  private val onProgress: (Int) -> Unit
) {
  interface Callbacks {
    fun onCompleted(output: File, durationMs: Long)
    fun onFailed(code: String, message: String, cause: Throwable?)
  }

  private val handler = Handler(Looper.getMainLooper())
  private val progressHolder = ProgressHolder()
  private var transformer: Transformer? = null
  private var callbacks: Callbacks? = null
  private var output: File? = null

  val isRunning: Boolean
    get() = transformer != null

  private val progressPoller = object : Runnable {
    override fun run() {
      val active = transformer ?: return
      if (active.getProgress(progressHolder) == Transformer.PROGRESS_STATE_AVAILABLE) {
        onProgress(progressHolder.progress)
      }
      handler.postDelayed(this, PROGRESS_INTERVAL_MS)
    }
  }

  fun start(spec: RenderSpec, callbacks: Callbacks) {
    val folder = File(context.cacheDir, OUTPUT_FOLDER).apply { mkdirs() }
    val outputFile = File(folder, "video-${System.currentTimeMillis()}.mp4")
    try {
      val composition = buildComposition(spec)
      val active = buildTransformer(spec, outputFile)
      transformer = active
      this.callbacks = callbacks
      output = outputFile
      active.start(composition, outputFile.absolutePath)
      handler.post(progressPoller)
    } catch (e: Exception) {
      reset()
      outputFile.delete()
      callbacks.onFailed("ERR_RENDER_START", e.message ?: "The video could not be prepared.", e)
    }
  }

  fun cancel() {
    val active = transformer ?: return
    val pending = callbacks
    val partialOutput = output
    active.cancel()
    reset()
    partialOutput?.delete()
    pending?.onFailed("ERR_RENDER_CANCELLED", "Saving the video was cancelled.", null)
  }

  private fun reset() {
    handler.removeCallbacks(progressPoller)
    transformer = null
    callbacks = null
    output = null
  }

  private fun buildTransformer(spec: RenderSpec, outputFile: File): Transformer {
    val videoSettings = VideoEncoderSettings.Builder()
      .setBitrate(spec.videoBitrate)
      .build()
    val audioSettings = AudioEncoderSettings.Builder()
      .setBitrate(AUDIO_BITRATE)
      .build()
    val encoderFactory = DefaultEncoderFactory.Builder(context)
      .setRequestedVideoEncoderSettings(videoSettings)
      .setRequestedAudioEncoderSettings(audioSettings)
      .setEnableFallback(true)
      .build()

    return Transformer.Builder(context)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setAudioMimeType(MimeTypes.AUDIO_AAC)
      .setEncoderFactory(encoderFactory)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          val pending = callbacks
          reset()
          pending?.onCompleted(outputFile, RenderMath.knownDurationMs(exportResult.durationMs))
        }

        override fun onError(
          composition: Composition,
          exportResult: ExportResult,
          exportException: ExportException
        ) {
          val pending = callbacks
          reset()
          outputFile.delete()
          val reason = ExportException.getErrorCodeName(exportException.errorCode)
          pending?.onFailed("ERR_RENDER_FAILED", "The video could not be saved ($reason).", exportException)
        }
      })
      .build()
  }

  private fun buildComposition(spec: RenderSpec): Composition {
    require(spec.clips.isNotEmpty()) { "No video clips were given." }
    require(spec.width > 0 && spec.height > 0) { "The output size is missing." }
    require(spec.videoBitrate > 0) { "The video bitrate is missing." }

    val overlayBitmap = spec.overlayUri?.let { loadBitmap(it) }
    val clips = spec.clips.map { buildClip(it, spec, overlayBitmap) }

    // Asking for an audio track makes Media3 add silence for clips that have none, so joined
    // clips always line up.
    val trackTypes = if (spec.keepOriginalAudio) {
      setOf(C.TRACK_TYPE_AUDIO, C.TRACK_TYPE_VIDEO)
    } else {
      setOf(C.TRACK_TYPE_VIDEO)
    }
    val sequences = mutableListOf(
      EditedMediaItemSequence.Builder(trackTypes).addItems(clips).build()
    )

    spec.musicUri?.let { musicUri ->
      val music = EditedMediaItem.Builder(MediaItem.fromUri(Uri.parse(musicUri)))
        .setEffects(Effects(listOf(gain(spec.musicVolume)), emptyList()))
        .build()
      // A looping sequence repeats the song until the video ends; Media3 mixes it with any kept sound.
      sequences.add(
        EditedMediaItemSequence.Builder(setOf(C.TRACK_TYPE_AUDIO))
          .addItem(music)
          .setIsLooping(true)
          .build()
      )
    }

    return Composition.Builder(sequences)
      .setHdrMode(Composition.HDR_MODE_TONE_MAP_HDR_TO_SDR_USING_OPEN_GL)
      .build()
  }

  private fun buildClip(clip: ClipSpec, spec: RenderSpec, overlayBitmap: Bitmap?): EditedMediaItem {
    val clipping = MediaItem.ClippingConfiguration.Builder()
      .setStartPositionMs(clip.startMs.toLong().coerceAtLeast(0L))
    if (clip.endMs > clip.startMs) {
      clipping.setEndPositionMs(clip.endMs.toLong())
    }
    val mediaItem = MediaItem.Builder()
      .setUri(Uri.parse(clip.uri))
      .setClippingConfiguration(clipping.build())
      .build()

    val videoEffects = mutableListOf<Effect>()
    val rotation = RenderMath.counterClockwiseFromClockwise(spec.rotationDegrees)
    if (rotation != 0) {
      videoEffects.add(
        ScaleAndRotateTransformation.Builder().setRotationDegrees(rotation.toFloat()).build()
      )
    }
    clip.crop?.let { crop ->
      RenderMath.toNdcCrop(crop.left, crop.top, crop.right, crop.bottom)?.let { ndc ->
        videoEffects.add(Crop(ndc.left, ndc.right, ndc.bottom, ndc.top))
      }
    }
    // Every clip is scaled to the same output size so joined clips share one frame size.
    videoEffects.add(
      Presentation.createForWidthAndHeight(
        spec.width,
        spec.height,
        Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP
      )
    )
    overlayBitmap?.let { bitmap ->
      val overlay: TextureOverlay = BitmapOverlay.createStaticBitmapOverlay(bitmap)
      videoEffects.add(OverlayEffect(listOf(overlay)))
    }

    val audioProcessors = mutableListOf<AudioProcessor>()
    if (spec.keepOriginalAudio && spec.originalVolume < FULL_VOLUME) {
      audioProcessors.add(gain(spec.originalVolume))
    }

    return EditedMediaItem.Builder(mediaItem)
      .setRemoveAudio(!spec.keepOriginalAudio)
      .setEffects(Effects(audioProcessors, videoEffects))
      .build()
  }

  private fun gain(volume: Double): AudioProcessor =
    GainProcessor(DefaultGainProvider.Builder(RenderMath.clampVolume(volume)).build())

  // Media3 blends overlay pixels as straight (not premultiplied) colours, so the layer is decoded
  // that way. This keeps the faded watermark and soft text shadows at their true colours.
  private fun loadBitmap(uri: String): Bitmap {
    val options = BitmapFactory.Options().apply { inPremultiplied = false }
    val bitmap = context.contentResolver.openInputStream(Uri.parse(uri))?.use {
      BitmapFactory.decodeStream(it, null, options)
    }
    return requireNotNull(bitmap) { "The logo and text layer could not be read." }
  }

  companion object {
    private const val OUTPUT_FOLDER = "rendered-videos"
    private const val PROGRESS_INTERVAL_MS = 500L
    private const val FULL_VOLUME = 0.999

    // Phones record stereo sound at about 256 kbps; 192 kbps AAC keeps it clear.
    private const val AUDIO_BITRATE = 192_000
  }
}
