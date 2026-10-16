// Stub de @prisma/client para ejecutar el generador de credenciales sin DB.
const ParticipantRole = {
  delegado: 'delegado',
  docente: 'docente',
  mesa: 'mesa',
  secretaria: 'secretaria',
  staff: 'staff',
  invitado: 'invitado',
};
module.exports = { ParticipantRole, PrismaClient: class PrismaClient {} };
