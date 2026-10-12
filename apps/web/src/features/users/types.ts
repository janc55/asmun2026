export type UserRole = 'admin' | 'registrador' | 'operador' | 'lector';

export interface AssignedCheckpoint {
  id: number;
  name: string;
  type: string;
  day: string;
  dayLabel: string;
}

export interface AppUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  assignedCheckpoints: AssignedCheckpoint[];
  checkpointIds: number[];
  scansCount: number;
}

export interface UserInput {
  username?: string;
  fullName?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  checkpointIds?: number[];
}

export const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string; description: string }> = [
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Todo: configuración, usuarios, excepciones y reportes.',
  },
  {
    value: 'registrador',
    label: 'Registrador',
    description: 'Acreditación: participantes, credenciales y puntos de entrega.',
  },
  {
    value: 'operador',
    label: 'Operador',
    description: 'Solo los puntos de control que tenga asignados.',
  },
  {
    value: 'lector',
    label: 'Lector',
    description: 'Solo panel y reportes, sin registrar.',
  },
];

export function userRoleLabel(role: string | null | undefined): string {
  return USER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? String(role ?? '—');
}
