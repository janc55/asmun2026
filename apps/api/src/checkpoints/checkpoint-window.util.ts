import { ParticipantRole } from '@prisma/client';
import { dayFromDateColumn, toDayString, toTimeLabel } from '../common/utils/datetime.util';

/**
 * Regla de ventana horaria de un punto de control (SDD 9.1, pasos 2 y 3).
 *
 * Un punto solo acepta registros si está activo, si su día es hoy y si el
 * instante actual cae dentro de su ventana. La misma evaluación alimenta la
 * etiqueta de estado que ve el operador y el resultado `fuera_de_horario` del
 * motor de escaneos, para que no existan dos verdades distintas.
 */

export type WindowFailure = 'desactivado' | 'otro_dia' | 'antes_de_abrir' | 'despues_de_cerrar';

export interface WindowEvaluation {
  open: boolean;
  failure?: WindowFailure;
  /** Día del punto en formato `YYYY-MM-DD`. */
  day: string;
  isToday: boolean;
  startsAtLabel: string | null;
  endsAtLabel: string | null;
}

export interface CheckpointWindowInput {
  day: Date;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export function evaluateCheckpointWindow(
  checkpoint: CheckpointWindowInput,
  now: Date = new Date(),
): WindowEvaluation {
  const day = dayFromDateColumn(checkpoint.day);
  const today = toDayString(now);
  const isToday = day === today;
  const startsAtLabel = checkpoint.startsAt ? toTimeLabel(checkpoint.startsAt) : null;
  const endsAtLabel = checkpoint.endsAt ? toTimeLabel(checkpoint.endsAt) : null;

  const base = { day, isToday, startsAtLabel, endsAtLabel };

  if (!checkpoint.isActive) {
    return { ...base, open: false, failure: 'desactivado' };
  }

  if (day !== today) {
    return { ...base, open: false, failure: 'otro_dia' };
  }

  if (checkpoint.startsAt && now.getTime() < checkpoint.startsAt.getTime()) {
    return { ...base, open: false, failure: 'antes_de_abrir' };
  }

  if (checkpoint.endsAt && now.getTime() > checkpoint.endsAt.getTime()) {
    return { ...base, open: false, failure: 'despues_de_cerrar' };
  }

  return { ...base, open: true };
}

/** Etiqueta de estado para la pantalla del operador y la tabla de administración. */
export type CheckpointStatusLabel = 'abierto' | 'programado' | 'finalizado' | 'desactivado';

export interface CheckpointStatus {
  isToday: boolean;
  isOpen: boolean;
  label: CheckpointStatusLabel;
  message: string;
}

export function describeCheckpointStatus(
  evaluation: WindowEvaluation,
  today: string = toDayString(new Date()),
): CheckpointStatus {
  if (evaluation.failure === 'desactivado') {
    return {
      isToday: evaluation.isToday,
      isOpen: false,
      label: 'desactivado',
      message: 'Punto desactivado por la organización.',
    };
  }

  if (evaluation.failure === 'otro_dia') {
    return {
      isToday: false,
      isOpen: false,
      label: evaluation.day > today ? 'programado' : 'finalizado',
      message:
        evaluation.day > today
          ? `Corresponde al ${evaluation.day}.`
          : `El punto fue el ${evaluation.day}.`,
    };
  }

  if (evaluation.failure === 'antes_de_abrir') {
    return {
      isToday: true,
      isOpen: false,
      label: 'programado',
      message: `Abre a las ${evaluation.startsAtLabel}.`,
    };
  }

  if (evaluation.failure === 'despues_de_cerrar') {
    return {
      isToday: true,
      isOpen: false,
      label: 'finalizado',
      message: evaluation.endsAtLabel ? `Cerró a las ${evaluation.endsAtLabel}.` : 'Fuera de horario.',
    };
  }

  return {
    isToday: true,
    isOpen: true,
    label: 'abierto',
    message: evaluation.endsAtLabel ? `Abierto hasta las ${evaluation.endsAtLabel}.` : 'Abierto.',
  };
}

/** Mensaje del resultado `fuera_de_horario` (SDD 9.2). */
export function describeWindowFailure(evaluation: WindowEvaluation, checkpointName: string): string {
  switch (evaluation.failure) {
    case 'desactivado':
      return `El punto '${checkpointName}' está desactivado. Consulte con acreditación.`;
    case 'otro_dia':
      return `'${checkpointName}' corresponde al día ${evaluation.day}.`;
    case 'antes_de_abrir':
      return `Este punto abre a las ${evaluation.startsAtLabel}.`;
    case 'despues_de_cerrar':
      return evaluation.endsAtLabel
        ? `Este punto cerró a las ${evaluation.endsAtLabel}.`
        : `El horario de '${checkpointName}' ya terminó.`;
    default:
      return 'Fuera del horario del punto de control.';
  }
}

/** `true` si el punto reparte comida (donde importan las restricciones alimentarias). */
export function isMealCheckpoint(type: string): boolean {
  return type === 'refrigerio' || type === 'almuerzo';
}

/** `true` si el punto aplica al rol (lista vacía o nula = todos los roles). */
export function appliesToRole(roles: ParticipantRole[] | null | undefined, role: ParticipantRole): boolean {
  if (!roles || roles.length === 0) return true;
  return roles.includes(role);
}
