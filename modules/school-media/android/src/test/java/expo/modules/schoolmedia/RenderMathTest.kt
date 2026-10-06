package expo.modules.schoolmedia

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class RenderMathTest {
  @Test
  fun wholeFrameCropIsSkipped() {
    assertNull(RenderMath.toNdcCrop(0.0, 0.0, 1.0, 1.0))
  }

  @Test
  fun cropIsConvertedToDeviceCoordinates() {
    val ndc = RenderMath.toNdcCrop(0.25, 0.1, 0.75, 0.9)
    assertNotNull(ndc)
    assertEquals(-0.5f, ndc!!.left, DELTA)
    assertEquals(0.5f, ndc.right, DELTA)
    assertEquals(0.8f, ndc.top, DELTA)
    assertEquals(-0.8f, ndc.bottom, DELTA)
  }

  @Test
  fun cropOutsideTheFrameIsClamped() {
    val ndc = RenderMath.toNdcCrop(-0.2, 0.0, 0.5, 1.2)
    assertNotNull(ndc)
    assertEquals(-1f, ndc!!.left, DELTA)
    assertEquals(-1f, ndc.bottom, DELTA)
  }

  @Test(expected = IllegalArgumentException::class)
  fun emptyCropIsRejected() {
    RenderMath.toNdcCrop(0.5, 0.2, 0.5, 0.9)
  }

  @Test
  fun clockwiseTurnsBecomeCounterclockwise() {
    assertEquals(0, RenderMath.counterClockwiseFromClockwise(0))
    assertEquals(270, RenderMath.counterClockwiseFromClockwise(90))
    assertEquals(180, RenderMath.counterClockwiseFromClockwise(180))
    assertEquals(90, RenderMath.counterClockwiseFromClockwise(270))
    assertEquals(90, RenderMath.counterClockwiseFromClockwise(-90))
  }

  @Test(expected = IllegalArgumentException::class)
  fun oddRotationIsRejected() {
    RenderMath.normalizeRotation(45)
  }

  @Test
  fun quarterTurnsSwapDisplaySize() {
    assertEquals(Pair(1080, 1920), RenderMath.displaySize(1920, 1080, 90))
    assertEquals(Pair(1080, 1920), RenderMath.displaySize(1920, 1080, 270))
    assertEquals(Pair(1920, 1080), RenderMath.displaySize(1920, 1080, 180))
  }

  @Test
  fun volumeAndDurationAreKeptInRange() {
    assertEquals(1f, RenderMath.clampVolume(1.7), DELTA)
    assertEquals(0f, RenderMath.clampVolume(-0.3), DELTA)
    assertEquals(0L, RenderMath.knownDurationMs(Long.MIN_VALUE + 1))
    assertEquals(2500L, RenderMath.knownDurationMs(2500L))
  }

  @Test
  fun joinedClipsAddUpTheirKeptParts() {
    val clips = listOf(Pair(5_000.0, 15_000.0), Pair(0.0, 2_000.0), Pair(3_000.0, 3_000.0))
    assertEquals(12_000.0, RenderMath.keptDurationMs(clips), 1e-9)
  }

  @Test
  fun fadeEndsWithTheVideo() {
    assertEquals(
      RenderMath.Fade(startUs = 10_000_000, durationUs = 2_000_000),
      RenderMath.closingFade(12_000.0, 2_000.0)
    )
  }

  @Test
  fun fadeIsNeverLongerThanTheVideo() {
    assertEquals(
      RenderMath.Fade(startUs = 0, durationUs = 800_000),
      RenderMath.closingFade(800.0, 2_000.0)
    )
  }

  @Test
  fun noFadeWhenNoneIsAsked() {
    assertNull(RenderMath.closingFade(12_000.0, 0.0))
    assertNull(RenderMath.closingFade(0.0, 2_000.0))
  }

  @Test
  fun fullVolumeIsReportedAMinuteAtATime() {
    val fourHours = 44_100L * 60 * 60 * 4
    assertEquals(44_100L * 60, RenderMath.fullVolumeUntil(fourHours, 0, 44_100))
    assertEquals(fourHours, RenderMath.fullVolumeUntil(fourHours, fourHours - 1_000, 44_100))
  }

  @Test
  fun noChangeAheadPassesThrough() {
    assertEquals(Long.MIN_VALUE, RenderMath.fullVolumeUntil(Long.MIN_VALUE, 0, 48_000))
  }

  private companion object {
    const val DELTA = 1e-6f
  }
}
