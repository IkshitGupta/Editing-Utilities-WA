package expo.modules.schoolmedia

import androidx.media3.common.Metadata
import androidx.media3.container.MdtaMetadataEntry
import androidx.media3.container.Mp4LocationData
import androidx.media3.container.Mp4OrientationData
import androidx.media3.container.Mp4TimestampData
import androidx.media3.container.XmpData
import java.nio.ByteBuffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class OutputMetadataTest {
  @Test
  fun locationIsLeftOut() {
    assertNull(filter(Mp4LocationData(26.91f, 75.79f)))
  }

  @Test
  fun xmpIsLeftOut() {
    assertNull(filter(XmpData(byteArrayOf(1, 2, 3))))
  }

  @Test
  fun creationTimeBecomesTheSaveTime() {
    val result = filter(Mp4TimestampData(10L, 20L)) as Mp4TimestampData
    val expected = Mp4TimestampData.unixTimeToMp4TimeSeconds(NOW_MS)
    assertEquals(expected, result.creationTimestampSeconds)
    assertEquals(expected, result.modificationTimestampSeconds)
  }

  @Test
  fun orientationIsKept() {
    val orientation = Mp4OrientationData(90)
    assertSame(orientation, filter(orientation))
    assertSame(orientation, filter(orientation, keepCaptureRate = false))
  }

  @Test
  fun textKeysAreLeftOut() {
    val location = MdtaMetadataEntry(
      "com.apple.quicktime.location.ISO6709",
      "+26.9124+075.7873/".toByteArray(),
      MdtaMetadataEntry.TYPE_INDICATOR_STRING
    )
    assertNull(filter(location))
  }

  @Test
  fun captureFrameRateIsKeptForOneClip() {
    assertSame(CAPTURE_RATE, filter(CAPTURE_RATE))
  }

  @Test
  fun captureFrameRateIsLeftOutOfJoinedClips() {
    assertNull(filter(CAPTURE_RATE, keepCaptureRate = false))
  }

  private fun filter(entry: Metadata.Entry, keepCaptureRate: Boolean = true) =
    OutputMetadata.filter(entry, NOW_MS, keepCaptureRate)

  companion object {
    private const val NOW_MS = 1_791_200_000_000L
    private val CAPTURE_RATE = MdtaMetadataEntry(
      MdtaMetadataEntry.KEY_ANDROID_CAPTURE_FPS,
      ByteBuffer.allocate(4).putFloat(240f).array(),
      MdtaMetadataEntry.TYPE_INDICATOR_FLOAT32
    )
  }
}
