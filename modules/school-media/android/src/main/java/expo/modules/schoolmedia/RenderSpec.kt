package expo.modules.schoolmedia

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord

// Fractions of the (already rotated) frame, measured from the top-left corner.
@OptimizedRecord
class CropSpec : Record {
  @Field val left: Double = 0.0
  @Field val top: Double = 0.0
  @Field val right: Double = 1.0
  @Field val bottom: Double = 1.0
}

@OptimizedRecord
class ClipSpec : Record {
  @Field val uri: String = ""
  @Field val startMs: Double = 0.0
  @Field val endMs: Double = 0.0
  @Field val crop: CropSpec? = null
}

@OptimizedRecord
class RenderSpec : Record {
  @Field val clips: List<ClipSpec> = emptyList()

  // Clockwise, in quarter turns.
  @Field val rotationDegrees: Int = 0
  @Field val width: Int = 0
  @Field val height: Int = 0
  @Field val videoBitrate: Int = 0
  @Field val keepOriginalAudio: Boolean = true
  @Field val originalVolume: Double = 1.0
  @Field val musicUri: String? = null
  @Field val musicVolume: Double = 0.5

  // A transparent PNG at the output size holding the logo and text.
  @Field val overlayUri: String? = null

  // The saved video's file name, which the gallery shows.
  @Field val fileName: String? = null
}
