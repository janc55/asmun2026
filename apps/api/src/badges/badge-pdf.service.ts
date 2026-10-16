import { Injectable, Logger } from '@nestjs/common';
import { ParticipantRole } from '@prisma/client';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';
import {
  A4_HEIGHT,
  A4_WIDTH,
  CARDS_PER_PAGE,
  CARD_HEIGHT,
  CARD_NAVY,
  CARD_WIDTH,
  GAP_X,
  GAP_Y,
  LABEL_GRAY,
  QR_PLATE_BORDER,
  hexToRgb,
} from './badge.constants';

/** Lo mínimo que la credencial necesita de un participante. */
export interface BadgeParticipant {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  role: ParticipantRole;
  position?: string | null;
  country?: string | null;
  school?: { name: string } | null;
  committee?: { name: string; shortName?: string | null } | null;
}

export interface EventInfo {
  name: string;
  subtitle?: string | null;
}

export interface RenderOptions {
  /** `card` = una página por credencial del tamaño exacto de la tarjeta. */
  sheet: 'card' | 'a4';
  event: EventInfo;
}

const MARGIN_SIDE = 16;

/** QR de 3.3 cm (área negra ~2.8 cm tras el margen de silencio) ≥ 2.5 cm (SDD). */
const QR_SIZE = 94;
const QR_PADDING = 5;
const QR_RADIUS = 6;

/** Resolución del PNG del QR: ~240 dpi sobre 94 pt, más que suficiente. */
const QR_PIXELS = 320;

/**
 * Alturas de las franjas del fondo (medidas sobre assets/fondo-credencial.png,
 * 886 × 1240 px) usadas solo como respaldo si el archivo no existe.
 */
const FALLBACK_HEADER = 41.3;
const FALLBACK_FOOTER = 28.6;

/**
 * Coordenadas verticales de cada etiqueta, en pt desde el borde inferior de la
 * tarjeta (297.6 pt). Calibradas contra el fondo: la franja superior termina a
 * 256.3 pt, la inferior empieza a 28.6 pt y la placa del QR va de 41 a 145 pt.
 */
const COMMITTEE_Y = 228;
const NAME_Y = 196;
const COUNTRY_Y = 167;
const QR_BOTTOM_Y = 46;
const POSITION_Y = 10;

/**
 * El cargo se centra en la zona de la franja inferior libre del escudo del
 * colegio (el escudo ocupa hasta 38 pt del borde izquierdo), igual que en el
 * diseño de referencia.
 */
const POSITION_REGION_X = 46;
const POSITION_REGION_WIDTH = CARD_WIDTH - POSITION_REGION_X - MARGIN_SIDE;

/** Nombre de los archivos de fondo, en orden de preferencia. */
const BACKGROUND_FILES = ['fondo-credencial.png', 'fondo-credencial.jpg', 'fondo-credencial.jpeg'];

/** Color de pdf-lib a partir de un hex del SDD. */
function pdfColor(hex: string) {
  const color = hexToRgb(hex);
  return rgb(color.r, color.g, color.b);
}

/** PNG: firma `89 50 4E 47`. */
function isPng(bytes: Buffer): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

/**
 * JPEG *baseline* (`FFC0`): los visores PDF no decodifican JPEG progresivo
 * (`FFC2`), así que se descarta con un aviso en lugar de fallar el lote.
 */
function isBaselineJpeg(bytes: Buffer): boolean {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return false;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return false;
    const marker = bytes[offset + 1];
    if (marker === 0xc0) return true;
    if (marker === 0xc2) return false;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 2 + length;
  }
  return false;
}

/** Fuentes base (WinAnsi): cubren el español sin incrustar archivos de fuente. */
interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  mono: PDFFont;
}

interface PlateStyle {
  color?: any;
  borderColor?: any;
  borderWidth?: number;
}

@Injectable()
export class BadgePdfService {
  private readonly logger = new Logger(BadgePdfService.name);

  /**
   * Genera el PDF de credenciales. El QR contiene únicamente el código corto
   * (RNF-04): cero datos personales.
   */
  async render(participants: BadgeParticipant[], options: RenderOptions): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    pdf.setTitle('Credenciales ASMUN');
    pdf.setCreator('ASMUN Control');
    pdf.setProducer('ASMUN Control · pdf-lib');

    const fonts: FontSet = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
      mono: await pdf.embedFont(StandardFonts.CourierBold),
    };

    // Un QR por código; se cachea porque el mismo código puede repetirse si el
    // mismo participante se imprime dos veces. Los PNG se generan en paralelo
    // (por lotes) porque es la parte más costosa del lote de ~200 credenciales.
    const qrImages = new Map<string, PDFImage>();
    const uniqueCodes = Array.from(new Set(participants.map((participant) => participant.code)));
    const qrPngs = await this.renderQrPngs(uniqueCodes);

    for (const [code, png] of qrPngs) {
      // eslint-disable-next-line no-await-in-loop -- pdf-lib incrusta en un único documento
      qrImages.set(code, await pdf.embedPng(png));
    }

    // El fondo se incrusta una sola vez por documento y se reutiliza en todas
    // las tarjetas: el PDF crece una vez, sin importar el tamaño del lote.
    const background = await this.embedBackground(pdf);

    if (options.sheet === 'card') {
      for (const participant of participants) {
        const page = pdf.addPage([CARD_WIDTH, CARD_HEIGHT]);
        this.drawCard(
          page,
          { x: 0, y: 0 },
          participant,
          fonts,
          qrImages,
          background,
          options.event,
          { cropMarks: false, border: false },
        );
      }
    } else {
      for (let index = 0; index < participants.length; index += CARDS_PER_PAGE) {
        const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
        const chunk = participants.slice(index, index + CARDS_PER_PAGE);

        chunk.forEach((participant, slot) => {
          const column = slot % 2;
          const row = Math.floor(slot / 2);
          const x = GAP_X + column * (CARD_WIDTH + GAP_X);
          // Fila 0 arriba: se calcula desde el borde superior de la hoja.
          const y = A4_HEIGHT - GAP_Y - CARD_HEIGHT - row * (CARD_HEIGHT + GAP_Y);

          this.drawCard(page, { x, y }, participant, fonts, qrImages, background, options.event, {
            cropMarks: true,
            border: true,
          });
        });
      }
    }

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  /**
   * Incrusta `assets/fondo-credencial.*`. Si no existe o el formato no es
   * soportado se registra un aviso y la credencial se dibuja en respaldo
   * (franjas macizas), sin romper el lote de impresión.
   */
  private async embedBackground(pdf: PDFDocument): Promise<PDFImage | null> {
    for (const file of BACKGROUND_FILES) {
      // `dist/badges/../assets` según el layout de salida de tsc, y
      // `dist/src/badges/../../assets` cuando la raíz común es `apps/api`.
      const candidates = [
        join(__dirname, '..', 'assets', file),
        join(__dirname, '..', '..', 'assets', file),
      ];

      for (const path of candidates) {
        // eslint-disable-next-line no-await-in-loop -- se prueba un archivo por vez
        const bytes = await readFile(path).catch(() => null);
        if (!bytes) continue;

        try {
          if (isPng(bytes)) return await pdf.embedPng(bytes);
          if (isBaselineJpeg(bytes)) return await pdf.embedJpg(bytes);
          this.logger.warn(
            `El fondo ${path} no es un PNG ni un JPEG baseline (¿JPEG progresivo?); se ignora.`,
          );
        } catch (error) {
          this.logger.warn(`No se pudo incrustar el fondo ${path}: ${error}`);
        }
      }
    }

    this.logger.warn(
      'No se encontró assets/fondo-credencial.{png,jpg}; la credencial se genera con franjas en respaldo.',
    );
    return null;
  }

  /**
   * Genera los PNG de los QR por lotes concurrentes: es la parte más costosa al
   * imprimir las ~200 credenciales del evento.
   */
  private async renderQrPngs(codes: string[], concurrency = 12): Promise<Map<string, Buffer>> {
    const result = new Map<string, Buffer>();

    for (let index = 0; index < codes.length; index += concurrency) {
      const slice = codes.slice(index, index + concurrency);
      // eslint-disable-next-line no-await-in-loop -- los lotes son secuenciales entre sí
      const buffers = await Promise.all(
        slice.map((code) =>
          QRCode.toBuffer(code, {
            type: 'png',
            // 2 módulos de zona de silencio + los 5 pt de placa blanca: el QR
            // nunca roza el mapa de agua del fondo.
            margin: 2,
            width: QR_PIXELS,
            errorCorrectionLevel: 'M',
          }),
        ),
      );
      slice.forEach((code, position) => result.set(code, buffers[position]));
    }

    return result;
  }

  private drawCard(
    page: PDFPage,
    position: { x: number; y: number },
    participant: BadgeParticipant,
    fonts: FontSet,
    qrImages: Map<string, PDFImage>,
    background: PDFImage | null,
    event: EventInfo,
    options: { cropMarks: boolean; border: boolean },
  ): void {
    const { x, y } = position;
    const navy = pdfColor(CARD_NAVY);
    const labelGray = pdfColor(LABEL_GRAY);
    const gray200 = pdfColor(QR_PLATE_BORDER);
    const white = rgb(1, 1, 1);
    const contentWidth = CARD_WIDTH - MARGIN_SIDE * 2;
    const centered = { x, width: CARD_WIDTH };

    // Base blanca (por si el PNG lleva transparencia) bajo todo lo demás.
    page.drawRectangle({ x, y, width: CARD_WIDTH, height: CARD_HEIGHT, color: white });

    if (background) {
      page.drawImage(background, { x, y, width: CARD_WIDTH, height: CARD_HEIGHT });
    } else {
      // Respaldo: franjas del color de la identidad si falta el archivo.
      page.drawRectangle({
        x,
        y: y + CARD_HEIGHT - FALLBACK_HEADER,
        width: CARD_WIDTH,
        height: FALLBACK_HEADER,
        color: navy,
      });
      page.drawRectangle({
        x,
        y,
        width: CARD_WIDTH,
        height: FALLBACK_FOOTER,
        color: navy,
      });
      const eventName = toWinAnsi(event.name || 'ASMUN');
      const eventSize = this.fitFont(eventName, fonts.bold, contentWidth, 12, 7);
      this.drawCentered(page, eventName, {
        ...centered,
        y: y + CARD_HEIGHT - FALLBACK_HEADER / 2 - eventSize * 0.35,
        size: eventSize,
        font: fonts.bold,
        color: white,
      });
    }

    if (options.border) {
      page.drawRectangle({
        x,
        y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderColor: gray200,
        borderWidth: 0.8,
      });
    }
    if (options.cropMarks) this.drawCropMarks(page, x, y);

    // ── Comité ──
    if (participant.committee?.name) {
      const committee = toWinAnsi(participant.committee.name);
      const size = this.fitFont(committee, fonts.regular, contentWidth, 12, 8);
      this.drawCentered(page, committee, {
        ...centered,
        y: y + COMMITTEE_Y,
        size,
        font: fonts.regular,
        color: labelGray,
      });
    }

    // ── Nombre completo ──
    const fullName = toWinAnsi(
      `${participant.firstName ?? ''} ${participant.lastName ?? ''}`.trim(),
    );
    const nameSize = this.fitFont(fullName, fonts.bold, contentWidth, 16, 9);
    this.drawCentered(page, fullName, {
      ...centered,
      y: y + NAME_Y,
      size: nameSize,
      font: fonts.bold,
      color: navy,
    });

    // ── País ──
    if (participant.country) {
      const country = toWinAnsi(participant.country);
      const size = this.fitFont(country, fonts.regular, contentWidth, 12, 8);
      this.drawCentered(page, country, {
        ...centered,
        y: y + COUNTRY_Y,
        size,
        font: fonts.regular,
        color: labelGray,
      });
    }

    // ── QR sobre placa blanca con esquinas redondeadas ──
    const plateSize = QR_SIZE + QR_PADDING * 2;
    const plateX = x + (CARD_WIDTH - plateSize) / 2;
    const plateY = y + QR_BOTTOM_Y - QR_PADDING;
    this.drawRoundedRect(page, plateX, plateY, plateSize, plateSize, QR_RADIUS, {
      color: white,
      borderColor: gray200,
      borderWidth: 0.8,
    });

    const qrImage = qrImages.get(participant.code);
    if (qrImage) {
      page.drawImage(qrImage, {
        x: x + (CARD_WIDTH - QR_SIZE) / 2,
        y: y + QR_BOTTOM_Y,
        width: QR_SIZE,
        height: QR_SIZE,
      });
    }

    // ── Cargo sobre la franja inferior, a la derecha del escudo ──
    if (participant.position) {
      const positionText = toWinAnsi(participant.position);
      const size = this.fitFont(positionText, fonts.bold, POSITION_REGION_WIDTH, 12, 7);
      this.drawCentered(page, positionText, {
        x: x + POSITION_REGION_X,
        width: POSITION_REGION_WIDTH,
        y: y + POSITION_Y,
        size,
        font: fonts.bold,
        color: white,
      });
    }
  }

  /**
   * Rectángulo con esquinas redondeadas vía `drawSvgPath`: pdf-lib ancla el
   * origen en el extremo superior izquierdo e invierte el eje Y, así que el
   * path usa coordenadas SVG (Y hacia abajo) desde esa esquina.
   */
  private drawRoundedRect(
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    style: PlateStyle,
  ): void {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    const path = [
      `M ${r} 0`,
      `L ${width - r} 0`,
      `Q ${width} 0 ${width} ${r}`,
      `L ${width} ${height - r}`,
      `Q ${width} ${height} ${width - r} ${height}`,
      `L ${r} ${height}`,
      `Q 0 ${height} 0 ${height - r}`,
      `L 0 ${r}`,
      `Q 0 0 ${r} 0`,
      'Z',
    ].join(' ');

    page.drawSvgPath(path, { x, y: y + height, ...style });
  }

  /** Marcas de corte en las cuatro esquinas de la tarjeta (impresión en A4). */
  private drawCropMarks(page: PDFPage, x: number, y: number): void {
    const color = hexToRgb('#9CA3AF');
    const gap = 2;
    const length = 9;
    const thickness = 0.4;

    const corners: Array<{ cx: number; cy: number; dx: number; dy: number }> = [
      { cx: x, cy: y, dx: -1, dy: -1 },
      { cx: x + CARD_WIDTH, cy: y, dx: 1, dy: -1 },
      { cx: x, cy: y + CARD_HEIGHT, dx: -1, dy: 1 },
      { cx: x + CARD_WIDTH, cy: y + CARD_HEIGHT, dx: 1, dy: 1 },
    ];

    corners.forEach(({ cx, cy, dx, dy }) => {
      page.drawLine({
        start: { x: cx + dx * gap, y: cy },
        end: { x: cx + dx * (gap + length), y: cy },
        thickness,
        color: rgb(color.r, color.g, color.b),
      });
      page.drawLine({
        start: { x: cx, y: cy + dy * gap },
        end: { x: cx, y: cy + dy * (gap + length) },
        thickness,
        color: rgb(color.r, color.g, color.b),
      });
    });
  }

  private drawCentered(
    page: PDFPage,
    text: string,
    options: { x: number; width: number; y: number; size: number; font: PDFFont; color: any },
  ): void {
    if (!text) return;
    const textWidth = options.font.widthOfTextAtSize(text, options.size);
    page.drawText(text, {
      x: options.x + (options.width - textWidth) / 2,
      y: options.y,
      size: options.size,
      font: options.font,
      color: options.color,
    });
  }

  /** Reduce el tamaño de fuente hasta que el texto entre en el ancho disponible. */
  private fitFont(text: string, font: PDFFont, maxWidth: number, preferred: number, min: number): number {
    if (!text) return preferred;
    let size = preferred;
    while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 0.5;
    }
    return size;
  }
}

const UNICODE_REPLACEMENTS: Array<[string, string]> = [
  ['—', '-'],
  ['–', '-'],
  ['−', '-'],
  ['“', '"'],
  ['”', '"'],
  ['„', '"'],
  ['‘', "'"],
  ['’', "'"],
  ['…', '...'],
  ['·', '-'],
  ['•', '-'],
  ['\u00A0', ' '],
  ['\t', ' '],
  ['\n', ' '],
  ['\r', ''],
];

/**
 * Las fuentes estándar de pdf-lib usan WinAnsi: se limpia cualquier carácter
 * fuera de ese conjunto para que un nombre con emojis o símbolos raros no rompa
 * la generación completa del lote.
 */
export function toWinAnsi(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  let text = String(input);
  UNICODE_REPLACEMENTS.forEach(([from, to]) => {
    text = text.split(from).join(to);
  });
  return text
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
