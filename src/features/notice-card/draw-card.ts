import {
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

import { layoutParagraph } from '@/lib/skia';

import { fitFontSize, formatNoticeDate } from './fit';
import { CARD_SIZES, THEMES, type NoticeStyle, type Theme } from './styles';

export type Notice = {
  title: string;
  body: string;
  date: Date;
};

export type SchoolInfo = {
  name: string;
  address: string;
  phone: string;
};

export type CardAssets = {
  fonts: SkTypefaceFontProvider | null;
  logo: SkImage | null;
};

export type CardResult = {
  // The notice text did not fit even at the smallest size and was cut short.
  overflow: boolean;
};

const MUTED = '#4B5563';
const DIVIDER = '#D1D5DB';
const BODY_LINE_HEIGHT = 1.3;

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

function drawImageInBox(
  canvas: SkCanvas,
  image: SkImage,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const aspect = image.width() / image.height();
  let drawWidth = width;
  let drawHeight = width / aspect;
  if (drawHeight > height) {
    drawHeight = height;
    drawWidth = height * aspect;
  }
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

function contactText(school: SchoolInfo): string {
  const lines = [school.address.trim(), school.phone.trim() ? `Phone: ${school.phone.trim()}` : ''];
  return lines.filter(Boolean).join('\n');
}

function letterheadHeader(context: Context): number {
  const { canvas, width, margin, theme } = context;
  fillRect(canvas, 0, 0, width, width * 0.018, theme.primary);
  fillRect(canvas, 0, width * 0.018, width, width * 0.008, theme.accent);
  const top = width * 0.06;
  const logoSize = width * 0.15;
  const textX = context.logo ? margin + logoSize + width * 0.03 : margin;
  if (context.logo) {
    drawImageInBox(canvas, context.logo, margin, top, logoSize, logoSize);
  }
  const name = text(
    context,
    context.school.name,
    { size: width * 0.058, color: theme.dark, bold: true, maxLines: 2 },
    width - margin - textX
  );
  const headerHeight = Math.max(context.logo ? logoSize : 0, name.getHeight());
  name.paint(canvas, textX, top + (headerHeight - name.getHeight()) / 2);
  const ruleY = top + headerHeight + width * 0.03;
  fillRect(canvas, margin, ruleY, width - margin * 2, Math.max(3, width * 0.004), theme.primary);
  return ruleY + width * 0.045;
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
  const paragraph = text(
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

function bandHeader(context: Context): number {
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
  const name = text(
    context,
    context.school.name,
    { size: width * 0.058, color: theme.onPrimary, bold: true, maxLines: 2 },
    width - margin - textX
  );
  name.paint(canvas, textX, (bandHeight - name.getHeight()) / 2);
  return bandHeight + width * 0.06;
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
  const paragraph = text(
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

function minimalHeader(context: Context): number {
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
  const name = text(
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
  return y + width * 0.045;
}

function minimalFooter(context: Context): Footer {
  const { canvas, width, margin } = context;
  const contact = contactText(context.school);
  if (!contact) {
    return { height: width * 0.07, draw: () => undefined };
  }
  const paragraph = text(
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

function drawTitle(context: Context, title: string, top: number, align: TextAlign): number {
  const { canvas, width, margin, theme } = context;
  if (!title.trim()) {
    return top;
  }
  const contentWidth = width - margin * 2;
  const options = (size: number): TextOptions => ({
    size,
    color: theme.heading,
    bold: true,
    align,
  });
  // The biggest size that keeps the title on two lines.
  const { fontSize } = fitFontSize(
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
  return top + paragraph.getHeight() + width * 0.015;
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
  const measure = (size: number) =>
    text(
      context,
      value,
      { size, color: '#111827', align: options.align, lineHeight: BODY_LINE_HEIGHT },
      boxWidth
    );
  const { fontSize, overflow } = fitFontSize(
    width * 0.026,
    width * 0.05,
    (size) => measure(size).getHeight() <= available
  );
  const paragraph = overflow
    ? text(
        context,
        value,
        {
          size: fontSize,
          color: '#111827',
          align: options.align,
          lineHeight: BODY_LINE_HEIGHT,
          maxLines: Math.max(1, Math.floor(available / (fontSize * BODY_LINE_HEIGHT))),
        },
        boxWidth
      )
    : measure(fontSize);
  if (options.panel) {
    fillRoundRect(canvas, margin, top, width - margin * 2, bottom - top, width * 0.03, '#FFFFFF');
  }
  const offset = options.centerVertically
    ? Math.max(0, (available - paragraph.getHeight()) / 2)
    : 0;
  paragraph.paint(canvas, margin + padding, top + padding + offset);
  return overflow;
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
    school,
  };
  canvas.drawColor(Skia.Color('#FFFFFF'));

  let top: number;
  let footer: Footer;
  if (style.design === 'band') {
    top = bandHeader(context);
    footer = bandFooter(context);
  } else if (style.design === 'minimal') {
    top = minimalHeader(context);
    footer = minimalFooter(context);
  } else {
    top = letterheadHeader(context);
    footer = letterheadFooter(context);
  }

  const centered = style.design !== 'letterhead';
  const align = centered ? TextAlign.Center : TextAlign.Left;
  top = drawTitle(context, notice.title, top, TextAlign.Center);
  top = drawDate(context, notice.date, top, TextAlign.Center, style.design === 'band');
  const footerTop = size.height - footer.height;
  const overflow = drawBody(context, notice.body, top, footerTop - size.width * 0.03, {
    align,
    panel: style.design === 'band',
    centerVertically: style.design === 'minimal',
  });
  footer.draw(footerTop);
  return { overflow };
}
