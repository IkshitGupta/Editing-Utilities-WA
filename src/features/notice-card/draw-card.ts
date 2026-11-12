import {
  ClipOp,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  TextAlign,
  type SkCanvas,
  type SkImage,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import { oneLine } from '@/lib/format';
import { layoutParagraph } from '@/lib/skia';

import { contactText, fitFontSize, formatNoticeDate } from './fit';
import { CARD_SIZES, THEMES, type NoticeStyle, type Theme } from './styles';

export type Notice = {
  title: string;
  body: string;
  date: Date;
  // Shown whole, never cropped, between the date and the notice text.
  photo?: SkImage | null;
};

export type SchoolInfo = {
  name: string;
  address: string;
  phone: string;
  website: string;
};

export type CardAssets = {
  fonts: SkTypefaceFontProvider | null;
  logo: SkImage | null;
};

export type CardResult = {
  // Parts that did not fit even at their smallest size and were cut short.
  overflow: { title: boolean; body: boolean };
  // A photo left no room for even one line of the notice text, so the text was left off.
  bodyLeftOff: boolean;
};

const MUTED = '#4B5563';
const DIVIDER = '#D1D5DB';
const BODY_LINE_HEIGHT = 1.3;
const BODY_MIN_SIZE = 0.026;
// With a photo, the notice text is kept smaller, and the text with the gap above it to a share of
// the space, so the photo always keeps most of the room.
const PHOTO_TEXT_MAX_SIZE = 0.04;
const PHOTO_TEXT_SHARE = 0.4;

type Context = {
  canvas: SkCanvas;
  width: number;
  height: number;
  margin: number;
  theme: Theme;
  fonts: SkTypefaceFontProvider | null;
  logo: SkImage | null;
  school: SchoolInfo;
};

type TextOptions = {
  size: number;
  color: string;
  bold?: boolean;
  align?: TextAlign;
  maxLines?: number;
  lineHeight?: number;
};

type Header = {
  bottom: number;
};

type Footer = {
  height: number;
  draw: (top: number) => void;
};

function text(context: Context, value: string, options: TextOptions, width: number): SkParagraph {
  return layoutParagraph(
    {
      text: value,
      fontSize: options.size,
      color: options.color,
      bold: options.bold,
      align: options.align ?? TextAlign.Left,
      maxLines: options.maxLines,
      lineHeight: options.lineHeight,
    },
    width,
    context.fonts
  );
}

// The school's details are set once in Settings, so instead of cutting them short, the card makes
// their text smaller, as far as needed, to fit them within their lines.
function fittedText(
  context: Context,
  value: string,
  options: TextOptions & { maxLines: number },
  width: number
): SkParagraph {
  const measure = (size: number) =>
    text(context, value, { ...options, size, maxLines: undefined }, width);
  const full = measure(options.size);
  if (full.getLineMetrics().length <= options.maxLines) {
    return full;
  }
  const { fontSize, overflow } = fitFontSize(
    1,
    options.size,
    (size) => measure(size).getLineMetrics().length <= options.maxLines
  );
  // Line breaks can leave more lines than the limit allows at any size. The school's details are
  // joined so that this doesn't happen, but if it does, the text is cut at its normal size rather
  // than drawn too small to read.
  return text(context, value, { ...options, size: overflow ? options.size : fontSize }, width);
}

function fill(color: string) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  return paint;
}

function fillRect(
  canvas: SkCanvas,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
) {
  canvas.drawRect(Skia.XYWHRect(x, y, width, height), fill(color));
}

function fillRoundRect(
  canvas: SkCanvas,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string
) {
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, width, height), radius, radius), fill(color));
}

// The size of an image scaled to fit inside a box without changing its shape.
function containedSize(image: SkImage, width: number, height: number) {
  const aspect = image.width() / image.height();
  return width / aspect > height
    ? { width: height * aspect, height }
    : { width, height: width / aspect };
}

function drawImageInBox(
  canvas: SkCanvas,
  image: SkImage,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const { width: drawWidth, height: drawHeight } = containedSize(image, width, height);
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(
      x + (width - drawWidth) / 2,
      y + (height - drawHeight) / 2,
      drawWidth,
      drawHeight
    ),
    FilterMode.Linear,
    MipmapMode.Linear,
    null
  );
}

// Rounded corners like the card's panels and date pill.
function drawRoundedImage(
  canvas: SkCanvas,
  image: SkImage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const target = Skia.XYWHRect(x, y, width, height);
  canvas.save();
  canvas.clipRRect(Skia.RRectXY(target, radius, radius), ClipOp.Intersect, true);
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    target,
    FilterMode.Linear,
    MipmapMode.Linear,
    null
  );
  canvas.restore();
}

function letterheadHeader(context: Context): Header {
  const { canvas, width, margin, theme } = context;
  fillRect(canvas, 0, 0, width, width * 0.018, theme.primary);
  fillRect(canvas, 0, width * 0.018, width, width * 0.008, theme.accent);
  const top = width * 0.06;
  const logoSize = width * 0.15;
  const textX = context.logo ? margin + logoSize + width * 0.03 : margin;
  if (context.logo) {
    drawImageInBox(canvas, context.logo, margin, top, logoSize, logoSize);
  }
  const name = fittedText(
    context,
    context.school.name,
    { size: width * 0.058, color: theme.dark, bold: true, maxLines: 2 },
    width - margin - textX
  );
  const headerHeight = Math.max(context.logo ? logoSize : 0, name.getHeight());
  name.paint(canvas, textX, top + (headerHeight - name.getHeight()) / 2);
  const ruleY = top + headerHeight + width * 0.03;
  fillRect(canvas, margin, ruleY, width - margin * 2, Math.max(3, width * 0.004), theme.primary);
  return { bottom: ruleY + width * 0.045 };
}

function letterheadFooter(context: Context): Footer {
  const { canvas, width, height, margin, theme } = context;
  const barHeight = width * 0.018;
  const contact = contactText(context.school);
  if (!contact) {
    return {
      height: barHeight + width * 0.03,
      draw: () => fillRect(canvas, 0, height - barHeight, width, barHeight, theme.primary),
    };
  }
  const paragraph = fittedText(
    context,
    contact,
    { size: width * 0.027, color: MUTED, align: TextAlign.Center, maxLines: 3, lineHeight: 1.25 },
    width - margin * 2
  );
  const gapAbove = width * 0.025;
  const gapBelow = width * 0.03;
  return {
    height: gapAbove + paragraph.getHeight() + gapBelow + barHeight,
    draw: (top) => {
      fillRect(canvas, margin, top, width - margin * 2, 2, DIVIDER);
      paragraph.paint(canvas, margin, top + gapAbove);
      fillRect(canvas, 0, height - barHeight, width, barHeight, theme.primary);
    },
  };
}

function bandHeader(context: Context): Header {
  const { canvas, width, margin, theme } = context;
  canvas.drawColor(Skia.Color(theme.tint));
  const bandHeight = width * 0.24;
  fillRect(canvas, 0, 0, width, bandHeight, theme.primary);
  fillRect(canvas, 0, bandHeight, width, width * 0.01, theme.accent);
  let textX = margin;
  if (context.logo) {
    // A white disc keeps the logo visible on any band colour.
    const radius = bandHeight * 0.36;
    const centerX = margin + radius;
    const centerY = bandHeight / 2;
    canvas.drawCircle(centerX, centerY, radius, fill('#FFFFFF'));
    drawImageInBox(
      canvas,
      context.logo,
      centerX - radius * 0.78,
      centerY - radius * 0.78,
      radius * 1.56,
      radius * 1.56
    );
    textX = margin + radius * 2 + width * 0.035;
  }
  const name = fittedText(
    context,
    context.school.name,
    { size: width * 0.058, color: theme.onPrimary, bold: true, maxLines: 2 },
    width - margin - textX
  );
  name.paint(canvas, textX, (bandHeight - name.getHeight()) / 2);
  return { bottom: bandHeight + width * 0.06 };
}

function bandFooter(context: Context): Footer {
  const { canvas, width, height, margin, theme } = context;
  const contact = contactText(context.school);
  if (!contact) {
    const strip = width * 0.03;
    return {
      height: strip + width * 0.03,
      draw: () => fillRect(canvas, 0, height - strip, width, strip, theme.primary),
    };
  }
  const paragraph = fittedText(
    context,
    contact,
    {
      size: width * 0.027,
      color: theme.onPrimary,
      align: TextAlign.Center,
      maxLines: 3,
      lineHeight: 1.25,
    },
    width - margin * 2
  );
  const padding = width * 0.03;
  const bandHeight = paragraph.getHeight() + padding * 2;
  return {
    height: bandHeight + width * 0.03,
    draw: () => {
      fillRect(canvas, 0, height - bandHeight, width, bandHeight, theme.primary);
      paragraph.paint(canvas, margin, height - bandHeight + padding);
    },
  };
}

function minimalHeader(context: Context): Header {
  const { canvas, width, height, margin, theme } = context;
  const inset = width * 0.03;
  const border = Skia.Paint();
  border.setAntiAlias(true);
  border.setStyle(PaintStyle.Stroke);
  border.setStrokeWidth(width * 0.006);
  border.setColor(Skia.Color(theme.primary));
  canvas.drawRRect(
    Skia.RRectXY(
      Skia.XYWHRect(inset, inset, width - inset * 2, height - inset * 2),
      width * 0.03,
      width * 0.03
    ),
    border
  );
  let y = width * 0.075;
  if (context.logo) {
    const logoSize = width * 0.16;
    drawImageInBox(canvas, context.logo, (width - logoSize) / 2, y, logoSize, logoSize);
    y += logoSize + width * 0.02;
  }
  const name = fittedText(
    context,
    context.school.name,
    { size: width * 0.05, color: theme.dark, bold: true, align: TextAlign.Center, maxLines: 2 },
    width - margin * 2
  );
  name.paint(canvas, margin, y);
  y += name.getHeight() + width * 0.025;
  fillRect(
    canvas,
    width / 2 - width * 0.06,
    y,
    width * 0.12,
    Math.max(3, width * 0.005),
    theme.accent
  );
  return { bottom: y + width * 0.045 };
}

function minimalFooter(context: Context): Footer {
  const { canvas, width, margin } = context;
  const contact = contactText(context.school);
  if (!contact) {
    return { height: width * 0.07, draw: () => undefined };
  }
  const paragraph = fittedText(
    context,
    contact,
    { size: width * 0.026, color: MUTED, align: TextAlign.Center, maxLines: 3, lineHeight: 1.25 },
    width - margin * 2
  );
  const gapBelow = width * 0.07;
  return {
    height: paragraph.getHeight() + gapBelow + width * 0.02,
    draw: (top) => paragraph.paint(canvas, margin, top + width * 0.02),
  };
}

function drawTitle(
  context: Context,
  title: string,
  top: number,
  align: TextAlign
): { bottom: number; cut: boolean } {
  const { canvas, width, margin, theme } = context;
  if (!title.trim()) {
    return { bottom: top, cut: false };
  }
  const contentWidth = width - margin * 2;
  const options = (size: number): TextOptions => ({
    size,
    color: theme.heading,
    bold: true,
    align,
  });
  // The biggest size that keeps the title on two lines.
  const { fontSize, overflow } = fitFontSize(
    width * 0.045,
    width * 0.068,
    (size) => text(context, title.trim(), options(size), contentWidth).getLineMetrics().length <= 2
  );
  const paragraph = text(
    context,
    title.trim(),
    { ...options(fontSize), maxLines: 2 },
    contentWidth
  );
  paragraph.paint(canvas, margin, top);
  return { bottom: top + paragraph.getHeight() + width * 0.015, cut: overflow };
}

function drawDate(
  context: Context,
  date: Date,
  top: number,
  align: TextAlign,
  pill: boolean
): number {
  const { canvas, width, margin, theme } = context;
  const label = formatNoticeDate(date);
  const paragraph = text(
    context,
    label,
    { size: width * 0.032, color: pill ? theme.dark : MUTED, align },
    width - margin * 2
  );
  if (pill) {
    const textWidth = paragraph.getLongestLine();
    const padX = width * 0.03;
    const padY = width * 0.012;
    const left = align === TextAlign.Center ? (width - textWidth) / 2 - padX : margin - padX;
    fillRoundRect(
      canvas,
      left,
      top - padY,
      textWidth + padX * 2,
      paragraph.getHeight() + padY * 2,
      width * 0.03,
      theme.accent
    );
  }
  paragraph.paint(canvas, margin, top);
  return top + paragraph.getHeight() + width * 0.04;
}

// The biggest size, up to the given one, at which the notice text fits in the space. Text that
// doesn't fit even at the smallest size is cut to the lines that do.
function fitBodyText(
  context: Context,
  value: string,
  width: number,
  height: number,
  maxSize: number,
  align: TextAlign
): { paragraph: SkParagraph; overflow: boolean } {
  const measure = (size: number) =>
    text(context, value, { size, color: '#111827', align, lineHeight: BODY_LINE_HEIGHT }, width);
  const { fontSize, overflow } = fitFontSize(
    context.width * BODY_MIN_SIZE,
    maxSize,
    (size) => measure(size).getHeight() <= height
  );
  const paragraph = overflow
    ? text(
        context,
        value,
        {
          size: fontSize,
          color: '#111827',
          align,
          lineHeight: BODY_LINE_HEIGHT,
          maxLines: Math.max(1, Math.floor(height / (fontSize * BODY_LINE_HEIGHT))),
        },
        width
      )
    : measure(fontSize);
  return { paragraph, overflow };
}

function drawBody(
  context: Context,
  body: string,
  top: number,
  bottom: number,
  options: { align: TextAlign; panel: boolean; centerVertically: boolean }
): boolean {
  const { canvas, width, margin } = context;
  const value = body.trim();
  if (!value) {
    return false;
  }
  const padding = options.panel ? width * 0.04 : 0;
  const boxWidth = width - margin * 2 - padding * 2;
  const available = bottom - top - padding * 2;
  if (available <= 0) {
    return true;
  }
  const { paragraph, overflow } = fitBodyText(
    context,
    value,
    boxWidth,
    available,
    width * 0.05,
    options.align
  );
  if (options.panel) {
    fillRoundRect(canvas, margin, top, width - margin * 2, bottom - top, width * 0.03, '#FFFFFF');
  }
  const offset = options.centerVertically
    ? Math.max(0, (available - paragraph.getHeight()) / 2)
    : 0;
  paragraph.paint(canvas, margin + padding, top + padding + offset);
  return overflow;
}

// The photo takes all the space the notice text leaves, and the two are centred together, which
// leaves even gaps around a wide photo. The text goes straight on the card, because the colour band
// design's white panel would take room that the photo and text need.
function drawPhotoAndBody(
  context: Context,
  photo: SkImage,
  body: string,
  top: number,
  bottom: number,
  align: TextAlign
): { cut: boolean; leftOff: boolean } {
  const { canvas, width, margin } = context;
  const value = body.trim();
  const space = bottom - top;
  const contentWidth = width - margin * 2;
  const gap = width * 0.03;
  const textHeight = space * PHOTO_TEXT_SHARE - gap;
  // One line at the smallest size. The fitting rounds that size up to a whole pixel, and the text
  // layout rounds each line's height to the nearest pixel.
  const smallestLine = Math.round(Math.ceil(width * BODY_MIN_SIZE) * BODY_LINE_HEIGHT);
  // Cutting text short still draws one line, which on a crowded card would take the photo's room.
  const leftOff = value.length > 0 && textHeight < smallestLine;
  const fitted =
    value && !leftOff
      ? fitBodyText(context, value, contentWidth, textHeight, width * PHOTO_TEXT_MAX_SIZE, align)
      : null;
  const textSpace = fitted ? fitted.paragraph.getHeight() + gap : 0;
  const photoSize = containedSize(photo, contentWidth, Math.max(0, space - textSpace));
  const y = top + Math.max(0, (space - photoSize.height - textSpace) / 2);
  if (photoSize.height > 0) {
    drawRoundedImage(
      canvas,
      photo,
      margin + (contentWidth - photoSize.width) / 2,
      y,
      photoSize.width,
      photoSize.height,
      width * 0.02
    );
  }
  fitted?.paragraph.paint(canvas, margin, y + photoSize.height + gap);
  return { cut: fitted?.overflow ?? false, leftOff };
}

// A card that has only a photo, with no title or notice text, leaves out the date too.
export function showsDate(notice: Notice): boolean {
  return !notice.photo || notice.title.trim().length > 0 || notice.body.trim().length > 0;
}

// Draws the whole card in a coordinate space the size of the card.
export function drawNoticeCard(
  canvas: SkCanvas,
  notice: Notice,
  style: NoticeStyle,
  assets: CardAssets,
  school: SchoolInfo
): CardResult {
  const size = CARD_SIZES[style.size];
  const context: Context = {
    canvas,
    width: size.width,
    height: size.height,
    margin: size.width * 0.065,
    theme: THEMES[style.theme],
    fonts: assets.fonts,
    logo: assets.logo,
    school: { ...school, name: oneLine(school.name) },
  };
  canvas.drawColor(Skia.Color('#FFFFFF'));

  let header: Header;
  let footer: Footer;
  if (style.design === 'band') {
    header = bandHeader(context);
    footer = bandFooter(context);
  } else if (style.design === 'minimal') {
    header = minimalHeader(context);
    footer = minimalFooter(context);
  } else {
    header = letterheadHeader(context);
    footer = letterheadFooter(context);
  }

  const centered = style.design !== 'letterhead';
  const align = centered ? TextAlign.Center : TextAlign.Left;
  const title = drawTitle(context, notice.title, header.bottom, TextAlign.Center);
  const top = showsDate(notice)
    ? drawDate(context, notice.date, title.bottom, TextAlign.Center, style.design === 'band')
    : title.bottom;
  const footerTop = size.height - footer.height;
  const body = notice.photo
    ? drawPhotoAndBody(
        context,
        notice.photo,
        notice.body,
        top,
        footerTop - size.width * 0.03,
        align
      )
    : {
        cut: drawBody(context, notice.body, top, footerTop - size.width * 0.03, {
          align,
          panel: style.design === 'band',
          centerVertically: style.design === 'minimal',
        }),
        leftOff: false,
      };
  footer.draw(footerTop);
  return { overflow: { title: title.cut, body: body.cut }, bodyLeftOff: body.leftOff };
}
