import {
  FontWeight,
  ImageFormat,
  Skia,
  TextAlign,
  type SkCanvas,
  type SkParagraph,
  type SkParagraphStyle,
  type SkTextStyle,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

export const FONT_FAMILY = 'Noto Sans';

export type TextSpec = {
  text: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  align?: TextAlign;
  maxLines?: number;
  lineHeight?: number;
  shadow?: boolean;
};

// Optional keys are only added when set: Skia's native side reads every key that is present,
// and an undefined value makes it throw.
export function layoutParagraph(
  spec: TextSpec,
  width: number,
  fonts: SkTypefaceFontProvider | null
): SkParagraph {
  const paragraphStyle: SkParagraphStyle = { textAlign: spec.align ?? TextAlign.Left };
  if (spec.maxLines) {
    paragraphStyle.maxLines = spec.maxLines;
    paragraphStyle.ellipsis = '…';
  }

  const textStyle: SkTextStyle = {
    color: Skia.Color(spec.color),
    fontFamilies: [FONT_FAMILY],
    fontSize: spec.fontSize,
    fontStyle: { weight: spec.bold ? FontWeight.Bold : FontWeight.Normal },
  };
  if (spec.lineHeight) {
    textStyle.heightMultiplier = spec.lineHeight;
  }
  if (spec.shadow) {
    // A tight dark edge keeps light text readable on bright areas; the soft shadow lifts it.
    textStyle.shadows = [
      {
        color: Skia.Color('rgba(0, 0, 0, 0.55)'),
        blurRadius: spec.fontSize * 0.04,
        offset: Skia.Point(0, 0),
      },
      {
        color: Skia.Color('rgba(0, 0, 0, 0.6)'),
        blurRadius: spec.fontSize * 0.14,
        offset: Skia.Point(0, spec.fontSize * 0.05),
      },
    ];
  }

  const builder = fonts
    ? Skia.ParagraphBuilder.Make(paragraphStyle, fonts)
    : Skia.ParagraphBuilder.Make(paragraphStyle);
  builder.pushStyle(textStyle);
  builder.addText(spec.text);
  builder.pop();
  const paragraph = builder.build();
  paragraph.layout(width);
  return paragraph;
}

export type Size = { width: number; height: number };

// Draws into an offscreen surface and returns the encoded image.
export function renderToBytes(
  size: Size,
  format: ImageFormat,
  quality: number,
  draw: (canvas: SkCanvas) => void
): Uint8Array {
  const width = Math.round(size.width);
  const height = Math.round(size.height);
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (!surface) {
    throw new Error('Not enough memory to create this image.');
  }
  try {
    draw(surface.getCanvas());
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      return snapshot.encodeToBytes(format, quality);
    } finally {
      snapshot.dispose();
    }
  } finally {
    surface.dispose();
  }
}
