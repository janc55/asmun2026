/**
 * Conversiones de fecha para la interfaz.
 *
 * La API devuelve instantes ISO con el desplazamiento del evento
 * (`2026-10-23T12:00:00.000-04:00`) y días de calendario `YYYY-MM-DD`. El
 * navegador puede estar en otra zona, así que las conversiones se hacen siempre
 * contra `America/La_Paz` y nunca con `new Date(...)` + métodos locales.
 */

export const EVENT_TIMEZONE = 'America/La_Paz';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: EVENT_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Día de hoy del evento en `YYYY-MM-DD`. */
export function todayInEventZone(): string {
  return dayFormatter.format(new Date());
}

/** Día `YYYY-MM-DD` de un instante ISO. */
export function dayFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return dayFormatter.format(date);
}

/** Hora `HH:MM` de un instante ISO, en la zona del evento. */
export function timeFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return timeFormatter.format(date);
}

/**
 * Instante ISO con el desplazamiento del evento a partir del día y la hora que
 * escribe el organizador. Bolivia no aplica horario de verano (UTC-4 fijo), por
 * eso el desplazamiento es una constante explícita.
 */
export function toEventIso(day: string, time: string): string {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return `${day}T${normalizedTime}-04:00`;
}

/** Etiqueta legible `23/10/2026`. */
export function formatDayLabel(day: string): string {
  if (!day) return '—';
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

/** Suma días a un `YYYY-MM-DD`. */
export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Hora actual del evento en `HH:MM`. */
export function nowTimeInEventZone(): string {
  return timeFormatter.format(new Date());
}
