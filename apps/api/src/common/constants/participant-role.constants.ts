/** Etiquetas en español de los roles del participante (SDD 10.2). */
export const PARTICIPANT_ROLE_LABELS = {
  delegado: 'Delegado',
  docente: 'Docente',
  mesa: 'Mesa Directiva',
  secretaria: 'Secretaría',
  staff: 'Staff',
  invitado: 'Invitado',
} as const;

export function participantRoleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return (PARTICIPANT_ROLE_LABELS as Record<string, string>)[role] ?? String(role);
}
