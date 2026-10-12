import { Injectable, Logger } from '@nestjs/common';
import { ParticipantRole } from '@prisma/client';
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';
import { formatShortCode } from '../common/utils/code-generator.util';
import {
  A4_HEIGHT,
  A4_WIDTH,
  CARDS_PER_PAGE,
  CARD_HEIGHT,
  CARD_WIDTH,
  GAP_X,
  GAP_Y,
  hexToRgb,
  roleColor,
  roleLabel,
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
const BAND_HEIGHT = 46;
const FOOTER_HEIGHT = 26;
const QR_SIZE = 96;

/** Color de pdf-lib a partir de un hex del SDD. */
function pdfColor(hex: string) {
  const color = hexToRgb(hex);
  return rgb(color.r, color.g, color.b);
}

/**
 * Resolución del PNG del QR.
 *
 * El QR impreso mide 96 pt (3.4 cm) y el código de 6 caracteres produce un QR de
 * 21×21 módulos, así que 320 px equivalen a ~240 dpi: más que suficiente para
 * leerlo con la cámara. Subirlo a 512 px multiplica por ~2.5 el tiempo del lote
 * de 200 credenciales sin ganancia visible en la impresión.
 */
const QR_PIXELS = 320;

/** Fuentes base (WinAnsi): cubren el español sin incrustar archivos de fuente. */
interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  mono: PDFFont;
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

    if (options.sheet === 'card') {
      for (const participant of participants) {
        const page = pdf.addPage([CARD_WIDTH, CARD_HEIGHT]);
        this.drawCard(page, { x: 0, y: 0 }, participant, fonts, qrImages, options.event, {
          cropMarks: false,
          border: false,
        });
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

          this.drawCard(page, { x, y }, participant, fonts, qrImages, options.event, {
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
            margin: 0,
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
    event: EventInfo,
    options: { cropMarks: boolean; border: boolean },
  ): void {
    const { x, y } = position;
    const accent = roleColor(participant.role);
    const gray600 = pdfColor('#4B5563');
    const gray900 = pdfColor('#1F2937');
    const gray200 = pdfColor('#E5E7EB');
    const white = rgb(1, 1, 1);
    const contentWidth = CARD_WIDTH - MARGIN_SIDE * 2;

    if (options.border) {
      page.drawRectangle({
        x,
        y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        color: white,
        borderColor: gray200,
        borderWidth: 0.8,
      });
      this.drawCropMarks(page, x, y);
    }

    const top = y + CARD_HEIGHT;

    // Franja superior con el logo y el nombre del evento.
    page.drawRectangle({
      x,
      y: top - BAND_HEIGHT,
      width: CARD_WIDTH,
      height: BAND_HEIGHT,
      color: rgb(accent.r, accent.g, accent.b),
    });

    const brand = toWinAnsi('ASMUN');
    page.drawText(brand, {
      x: x + MARGIN_SIDE,
      y: top - 28,
      size: 19,
      font: fonts.bold,
      color: white,
    });

    const eventName = toWinAnsi(event.name || 'ASMUN');
    const eventSize = this.fitFont(eventName, fonts.regular, CARD_WIDTH - MARGIN_SIDE * 2, 8.5, 6);
    page.drawText(eventName, {
      x: x + MARGIN_SIDE,
      y: top - 40,
      size: eventSize,
      font: fonts.regular,
      color: white,
    });

    const roleText = toWinAnsi(roleLabel(participant.role).toUpperCase());
    const roleSize = this.fitFont(roleText, fonts.bold, 92, 9, 6.5);
    page.drawText(roleText, {
      x: x + CARD_WIDTH - MARGIN_SIDE - fonts.bold.widthOfTextAtSize(roleText, roleSize),
      y: top - 28,
      size: roleSize,
      font: fonts.bold,
      color: white,
    });

    // Bloque de identidad.
    let cursor = top - BAND_HEIGHT - 30;

    const firstName = toWinAnsi(participant.firstName);
    const firstNameSize = this.fitFont(firstName, fonts.bold, contentWidth, 16, 11);
    this.drawCentered(page, firstName, {
      x,
      width: CARD_WIDTH,
      y: cursor,
      size: firstNameSize,
      font: fonts.bold,
      color: gray900,
    });

    cursor -= 21;
    const lastName = toWinAnsi(participant.lastName);
    const lastNameSize = this.fitFont(lastName, fonts.bold, contentWidth, 17.5, 11);
    this.drawCentered(page, lastName, {
      x,
      width: CARD_WIDTH,
      y: cursor,
      size: lastNameSize,
      font: fonts.bold,
      color: gray900,
    });

    cursor -= 20;
    if (participant.committee?.name) {
      const committee = toWinAnsi(participant.committee.name);
      const size = this.fitFont(committee, fonts.regular, contentWidth, 11.5, 8);
      this.drawCentered(page, committee, {
        x,
        width: CARD_WIDTH,
        y: cursor,
        size,
        font: fonts.regular,
        color: gray900,
      });
      cursor -= 15;
    }

    if (participant.position) {
      const position = toWinAnsi(participant.position);
      const size = this.fitFont(position, fonts.regular, contentWidth, 10.5, 8);
      this.drawCentered(page, position, {
        x,
        width: CARD_WIDTH,
        y: cursor,
        size,
        font: fonts.italic,
        color: gray600,
      });
      cursor -= 15;
    }

    if (participant.country) {
      const country = toWinAnsi(participant.country);
      const size = this.fitFont(country, fonts.regular, contentWidth, 10.5, 8);
      this.drawCentered(page, country, {
        x,
        width: CARD_WIDTH,
        y: cursor,
        size,
        font: fonts.regular,
        color: gray600,
      });
      cursor -= 15;
    }

    if (participant.school?.name) {
      const school = toWinAnsi(participant.school.name);
      const size = this.fitFont(school, fonts.regular, contentWidth, 10, 7);
      this.drawCentered(page, school, {
        x,
        width: CARD_WIDTH,
        y: cursor,
        size,
        font: fonts.regular,
        color: gray600,
      });
    }

    // QR y código corto.
    const code = toWinAnsi(formatShortCode(participant.code));
    const codeSize = 19;
    const codeBaseline = y + FOOTER_HEIGHT + 16;
    const qrBottom = codeBaseline + codeSize + 12;
    const qrImage = qrImages.get(participant.code);

    if (qrImage) {
      page.drawImage(qrImage, {
        x: x + (CARD_WIDTH - QR_SIZE) / 2,
        y: qrBottom,
        width: QR_SIZE,
        height: QR_SIZE,
      });
    }

    this.drawCentered(page, code, {
      x,
      width: CARD_WIDTH,
      y: codeBaseline,
      size: codeSize,
      font: fonts.mono,
      color: gray900,
    });

    // Franja inferior con el color del rol (identificación visual rápida, RF-07).
    page.drawRectangle({
      x,
      y,
      width: CARD_WIDTH,
      height: FOOTER_HEIGHT,
      color: rgb(accent.r, accent.g, accent.b),
    });
    this.drawCentered(page, roleText, {
      x,
      width: CARD_WIDTH,
      y: y + 9,
      size: 10.5,
      font: fonts.bold,
      color: white,
    });
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
