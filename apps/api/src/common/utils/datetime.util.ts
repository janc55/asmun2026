/**
 * Fechas y horas del evento.
 *
 * La base guarda instantes (`TIMESTAMPTZ`) y días de calendario (`DATE`). Todo lo
 * que el organizador escribe o lee —"día 1", "abre 12:00", "ya recibió a las
 * 12:40"— está en la zona del evento (`America/La_Paz`, UTC-4 sin horario de
 * verano), así que las conversiones pasan siempre por aquí en lugar de depender
 * de la zona del servidor.
 */

export const EVENT_TIMEZONE = process.env.EVENT_TIMEZONE || 'America/La_Paz';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Descompone un instante en la zona indicada. */
function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = zonedFormatter(timeZone).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** Día de calendario `YYYY-MM-DD` de un instante, en la zona del evento. */
export function toDayString(date: Date, timeZone = EVENT_TIMEZONE): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Día de hoy en la zona del evento. */
export function todayInEventZone(timeZone = EVENT_TIMEZONE): string {
  return toDayString(new Date(), timeZone);
}

/** Hora `HH:MM` de un instante, en la zona del evento. */
export function toTimeLabel(date: Date, timeZone = EVENT_TIMEZONE): string {
  const parts = getZonedParts(date, timeZone);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

/**
 * ISO 8601 con el desplazamiento real de la zona del evento:
 * `2026-10-23T12:31:02.769-04:00` (SDD 12.1). Se conservan los milisegundos
 * para no perder precisión en la respuesta.
 */
export function toZonedIso(date: Date, timeZone = EVENT_TIMEZONE): string {
  const parts = getZonedParts(date, timeZone);
  const milliseconds = date.getMilliseconds();
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    milliseconds,
  );
  const offsetMinutes = Math.round((asUtc - date.getTime()) / 60000);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;

  return (
    `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` +
    `T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}.${pad(milliseconds, 3)}${offset}`
  );
}

export function isDayString(value: unknown): boolean {
  return typeof value === 'string' && DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Desplazamiento de la zona respecto a UTC, en minutos, para ese instante
 * (negativo al oeste de Greenwich). Se calcula a partir de la hora local.
 */
export function timeZoneOffsetMinutes(date: Date, timeZone = EVENT_TIMEZONE): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getMilliseconds(),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

const LOCAL_DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Interpreta un instante escrito por el organizador.
 *
 * Si trae desplazamiento (`...-04:00`) o `Z`, se respeta tal cual. Si viene sin
 * zona ("2026-10-23T12:00"), se interpreta en la zona del evento, que es lo que
 * la persona quiso decir al escribir el horario del punto de control.
 */
export function parseInstant(value: string, timeZone = EVENT_TIMEZONE): Date {
  const local = LOCAL_DATETIME_PATTERN.exec(value.trim());
  if (!local) return new Date(value);

  const [, day, hour, minute, second = '00'] = local;
  let candidate = new Date(`${day}T${hour}:${minute}:${second}.000Z`);

  // El desplazamiento puede depender de la fecha (horario de verano), así que se
  // corrige iterativamente hasta que la hora local coincida.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = timeZoneOffsetMinutes(candidate, timeZone);
    const adjusted = new Date(candidate.getTime() - offset * 60000);
    if (adjusted.getTime() === candidate.getTime()) break;
    candidate = adjusted;
  }

  return candidate;
}

/**
 * Convierte `YYYY-MM-DD` al `Date` que espera una columna `DATE` de PostgreSQL
 * (medianoche UTC, que es como la devuelve Prisma al leerla).
 */
export function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Día de calendario de un valor leído de una columna `DATE`. */
export function dayFromDateColumn(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Suma (o resta) días a un `YYYY-MM-DD`. */
export function addDays(day: string, amount: number): string {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return dayFromDateColumn(date);
}

/** Etiqueta corta en español para un día: `23/10/2026`. */
export function formatDayLabel(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}
