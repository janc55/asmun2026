import { ParticipantRole } from '@prisma/client';

/**
 * Geometría y estilo de la credencial (SDD sección 11).
 * Tarjeta vertical de 7.5 × 10.5 cm (crédito tipo carné); en hoja A4 caben
 * 4 por página con marcas de corte.
 * pdf-lib trabaja en puntos (1 pt = 1/72 pulgada).
 */
export const CM = 28.3465;

export const CARD_WIDTH = 7.5 * CM; // 212.6 pt
export const CARD_HEIGHT = 10.5 * CM; // 297.6 pt

export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;

export const CARDS_PER_ROW = 2;
export const CARDS_PER_COLUMN = 2;
export const CARDS_PER_PAGE = CARDS_PER_ROW * CARDS_PER_COLUMN;

export const GAP_X = (A4_WIDTH - CARDS_PER_ROW * CARD_WIDTH) / (CARDS_PER_ROW + 1);
export const GAP_Y = (A4_HEIGHT - CARDS_PER_COLUMN * CARD_HEIGHT) / (CARDS_PER_COLUMN + 1);

/**
 * Colores de las etiquetas de la credencial. `CARD_NAVY` se muestreó de la
 * franja del fondo (`assets/fondo-credencial.png`) para que el nombre combine.
 */
export const CARD_NAVY = '#13134F';
export const LABEL_GRAY = '#4B5563';
export const QR_PLATE_BORDER = '#E5E7EB';

/** Colores por rol del SDD 10.2 (chips de la interfaz; la credencial ya no usa franja de color). */
export const ROLE_COLORS: Record<ParticipantRole, string> = {
  [ParticipantRole.delegado]: '#1D4ED8',
  [ParticipantRole.docente]: '#0F766E',
  [ParticipantRole.mesa]: '#7C2D12',
  [ParticipantRole.secretaria]: '#6D28D9',
  [ParticipantRole.staff]: '#111827',
  [ParticipantRole.invitado]: '#B45309',
};

export const ROLE_LABELS: Record<ParticipantRole, string> = {
  [ParticipantRole.delegado]: 'Delegado',
  [ParticipantRole.docente]: 'Docente',
  [ParticipantRole.mesa]: 'Mesa Directiva',
  [ParticipantRole.secretaria]: 'Secretaría',
  [ParticipantRole.staff]: 'Staff',
  [ParticipantRole.invitado]: 'Invitado',
};

export { participantRoleLabel } from '../common/constants/participant-role.constants';

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/** Convierte `#1D4ED8` al color normalizado 0-1 de pdf-lib. */
export function hexToRgb(hex: string): RGBColor {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

export function roleColor(role: ParticipantRole): RGBColor {
  return hexToRgb(ROLE_COLORS[role] ?? ROLE_COLORS[ParticipantRole.delegado]);
}

export function roleLabel(role: ParticipantRole): string {
  return ROLE_LABELS[role] ?? String(role);
}
