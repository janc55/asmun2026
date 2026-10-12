import { Prisma } from '@prisma/client';
import { normalizeShortCode } from './code-generator.util';

/**
 * Filtro de búsqueda de participantes compartido por el listado, la búsqueda del
 * escáner y los pendientes del panel.
 *
 * Cada palabra debe aparecer en el nombre o el apellido, en cualquier orden
 * ("quispe ana" encuentra a "Ana Quispe"), y la misma caja de búsqueda resuelve
 * documento y código corto.
 */
export function buildParticipantSearchFilter(
  search?: string | null,
): Prisma.ParticipantWhereInput | null {
  const text = typeof search === 'string' ? search.trim() : '';
  if (!text) return null;

  const nameConditions: Prisma.ParticipantWhereInput[] = text
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ({
      OR: [
        { firstName: { contains: token, mode: 'insensitive' } },
        { lastName: { contains: token, mode: 'insensitive' } },
      ],
    }));

  const identityConditions: Prisma.ParticipantWhereInput[] = [
    { documentId: { contains: text, mode: 'insensitive' } },
  ];

  const normalizedCode = normalizeShortCode(text);
  if (normalizedCode.length >= 3) {
    identityConditions.push({ code: { contains: normalizedCode } });
  }

  return { OR: [{ AND: nameConditions }, { OR: identityConditions }] };
}
