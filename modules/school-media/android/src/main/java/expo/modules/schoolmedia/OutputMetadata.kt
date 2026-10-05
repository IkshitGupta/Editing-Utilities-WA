package expo.modules.schoolmedia

import androidx.annotation.OptIn
import androidx.media3.common.Metadata
import androidx.media3.common.util.UnstableApi
import androidx.media3.container.MdtaMetadataEntry
import androidx.media3.container.Mp4OrientationData
import androidx.media3.container.Mp4TimestampData
import androidx.media3.muxer.Muxer
import androidx.media3.transformer.DefaultMuxer
import com.google.common.collect.ImmutableList

// Saved videos carry only what players need: the orientation and, for a single clip, the
// slow-motion capture rate. Media3 copies the first clip's metadata into the output, so other
// details of the original recording, such as its place, date and camera, are left out, and the
// creation time becomes the save time.
@OptIn(UnstableApi::class)
internal object OutputMetadata {
  fun filter(entry: Metadata.Entry, nowMs: Long, keepCaptureRate: Boolean): Metadata.Entry? =
    when (entry) {
      is Mp4OrientationData -> entry
      is MdtaMetadataEntry ->
        entry.takeIf { keepCaptureRate && it.key == MdtaMetadataEntry.KEY_ANDROID_CAPTURE_FPS }
      is Mp4TimestampData -> {
        val seconds = Mp4TimestampData.unixTimeToMp4TimeSeconds(nowMs)
        Mp4TimestampData(seconds, seconds)
      }
      else -> null
    }
}

// A joined video mixes clips, so the first clip's capture rate would describe only part of it.
@OptIn(UnstableApi::class)
internal class OutputMetadataMuxerFactory(
  private val keepCaptureRate: Boolean,
  private val base: Muxer.Factory = DefaultMuxer.Factory()
) : Muxer.Factory {
  override fun create(path: String): Muxer =
    OutputMetadataMuxer(base.create(path), keepCaptureRate)

  override fun getSupportedSampleMimeTypes(trackType: Int): ImmutableList<String> =
    base.getSupportedSampleMimeTypes(trackType)

  override fun supportsWritingNegativeTimestampsInEditList(): Boolean =
    base.supportsWritingNegativeTimestampsInEditList()
}

@OptIn(UnstableApi::class)
private class OutputMetadataMuxer(
  private val base: Muxer,
  private val keepCaptureRate: Boolean
) : Muxer by base {
  override fun addMetadataEntry(metadataEntry: Metadata.Entry) {
    OutputMetadata.filter(metadataEntry, System.currentTimeMillis(), keepCaptureRate)
      ?.let(base::addMetadataEntry)
  }
}
