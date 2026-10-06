package expo.modules.schoolmedia

import kotlin.math.min
import kotlin.math.roundToLong

// Kept free of Android classes so it can be unit tested on the JVM.
object RenderMath {
  private const val EDGE_TOLERANCE = 0.0005
  private const val MIN_FADE_US = 1000L
  private const val MAX_FULL_VOLUME_STRETCH_S = 60L

  data class NdcRect(val left: Float, val right: Float, val bottom: Float, val top: Float)

  /**
   * The app describes crops as fractions of the frame measured from the top-left corner.
   * Media3's Crop effect uses normalised device coordinates instead: the frame spans -1 to 1
   * on both axes and y points up. Returns null when the crop keeps the whole frame.
   */
  fun toNdcCrop(left: Double, top: Double, right: Double, bottom: Double): NdcRect? {
    val l = left.coerceIn(0.0, 1.0)
    val t = top.coerceIn(0.0, 1.0)
    val r = right.coerceIn(0.0, 1.0)
    val b = bottom.coerceIn(0.0, 1.0)
    require(r > l && b > t) { "The crop area is empty." }
    val keepsWholeFrame = l <= EDGE_TOLERANCE && t <= EDGE_TOLERANCE &&
      r >= 1 - EDGE_TOLERANCE && b >= 1 - EDGE_TOLERANCE
    if (keepsWholeFrame) {
      return null
    }
    return NdcRect(
      left = (2 * l - 1).toFloat(),
      right = (2 * r - 1).toFloat(),
      bottom = (1 - 2 * b).toFloat(),
      top = (1 - 2 * t).toFloat()
    )
  }

  fun normalizeRotation(degrees: Int): Int {
    val normalized = ((degrees % 360) + 360) % 360
    require(normalized % 90 == 0) { "Rotation must be a multiple of 90 degrees." }
    return normalized
  }

  // The app's rotate button turns the picture clockwise, while Media3 rotates counterclockwise.
  fun counterClockwiseFromClockwise(clockwiseDegrees: Int): Int =
    (360 - normalizeRotation(clockwiseDegrees)) % 360

  // Phones often store portrait videos sideways with a rotation flag, so the displayed size
  // swaps width and height for quarter turns.
  fun displaySize(width: Int, height: Int, rotationDegrees: Int): Pair<Int, Int> {
    val rotation = ((rotationDegrees % 360) + 360) % 360
    return if (rotation == 90 || rotation == 270) Pair(height, width) else Pair(width, height)
  }

  fun clampVolume(volume: Double): Float = volume.coerceIn(0.0, 1.0).toFloat()

  // Media3 reports an unknown duration as a large negative number.
  fun knownDurationMs(durationMs: Long): Long = if (durationMs > 0) durationMs else 0

  data class Fade(val startUs: Long, val durationUs: Long)

  // Joined clips play one after another, so the video lasts as long as their kept parts together.
  fun keptDurationMs(clips: List<Pair<Double, Double>>): Double =
    clips.sumOf { (startMs, endMs) -> (endMs - startMs).coerceAtLeast(0.0) }

  // Places a fade of the given length at the very end of the video. Returns null when there is
  // nothing to fade.
  fun closingFade(videoMs: Double, fadeMs: Double): Fade? {
    val videoUs = (videoMs * 1000).roundToLong()
    val fadeUs = (fadeMs * 1000).roundToLong().coerceAtMost(videoUs)
    if (fadeUs < MIN_FADE_US) {
      return null
    }
    return Fade(startUs = videoUs - fadeUs, durationUs = fadeUs)
  }

  // Media3 counts the bytes up to the next change in volume in an int, which overflows when the
  // closing fade of a very long video is hours away, so a stretch at full volume is reported a
  // minute at a time. Media3's special negative values pass through unchanged.
  fun fullVolumeUntil(nextChange: Long, samplePosition: Long, sampleRate: Int): Long =
    if (nextChange < 0) {
      nextChange
    } else {
      min(nextChange, samplePosition + sampleRate * MAX_FULL_VOLUME_STRETCH_S)
    }
}
