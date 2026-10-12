/** Usuario autenticado tal como lo entrega `JwtStrategy.validate`. */
export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'registrador' | 'operador' | 'lector';
  isActive: boolean;
}
