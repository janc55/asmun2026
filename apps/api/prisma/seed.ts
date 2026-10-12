import { PrismaClient, UserRole, CheckpointType, ParticipantRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // 1. Usuario Administrador Inicial
  const adminUsername = (process.env.INITIAL_ADMIN_USERNAME || 'admin').toLowerCase();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'AdminAsmun2026!';
  const adminFullName = process.env.INITIAL_ADMIN_NAME || 'Administrador ASMUN';

  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  let adminUser = existingAdmin;
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    adminUser = await prisma.user.create({
      data: {
        username: adminUsername,
        fullName: adminFullName,
        passwordHash,
        role: UserRole.admin,
        isActive: true,
      },
    });
    console.log(`✓ Administrador creado: ${adminUsername}`);
  } else {
    console.log(`✓ Administrador verificado: ${adminUsername}`);
  }

  // 2. Usuarios Base para Operación (Registrador y Operador Puerta)
  const registradorUser = await prisma.user.upsert({
    where: { username: 'registrador' },
    update: {},
    create: {
      username: 'registrador',
      fullName: 'Acreditación y Registro',
      passwordHash: await bcrypt.hash('Registrador2026!', 10),
      role: UserRole.registrador,
      isActive: true,
    },
  });
  console.log('✓ Usuario registrador verificado');

  const operadorUser = await prisma.user.upsert({
    where: { username: 'operador' },
    update: {},
    create: {
      username: 'operador',
      fullName: 'Operador Puerta / Control',
      passwordHash: await bcrypt.hash('Operador2026!', 10),
      role: UserRole.operador,
      isActive: true,
    },
  });
  console.log('✓ Usuario operador verificado');

  // 3. Catálogo Base de Colegios
  const baseSchools = [
    { name: 'Colegio Americano de Oruro', city: 'Oruro' },
    { name: 'Colegio Anglo Americano', city: 'Oruro' },
    { name: 'Colegio La Salle', city: 'Oruro' },
    { name: 'Colegio San Ignacio', city: 'La Paz' },
    { name: 'Colegio Alemán', city: 'Oruro' },
    { name: 'Delegación Independiente', city: 'Oruro' },
  ];

  for (const s of baseSchools) {
    const exists = await prisma.school.findFirst({ where: { name: s.name } });
    if (!exists) {
      await prisma.school.create({ data: s });
    }
  }
  console.log(`✓ Colegios base verificados (${baseSchools.length})`);

  // 4. Catálogo Base de Comités
  const baseCommittees = [
    { name: 'Consejo de Seguridad', shortName: 'CS' },
    { name: 'Asamblea General (DISEC)', shortName: 'AG' },
    { name: 'Consejo Económico y Social', shortName: 'ECOSOC' },
    { name: 'Consejo de Derechos Humanos', shortName: 'CDH' },
    { name: 'Gabinete de Crisis Histórico', shortName: 'GCH' },
    { name: 'Organización de Estados Americanos', shortName: 'OEA' },
  ];

  for (const c of baseCommittees) {
    const exists = await prisma.committee.findFirst({ where: { name: c.name } });
    if (!exists) {
      await prisma.committee.create({ data: c });
    }
  }
  console.log(`✓ Comités base verificados (${baseCommittees.length})`);

  // 5. Configuración Base de Puntos de Control para los 4 Días
  // Fechas del evento: 4 días consecutivos de ejemplo (o tomadas desde env)
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  const getDayDate = (dayOffset: number) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + dayOffset);
    return d;
  };

  // Día 1
  const day1Date = getDayDate(0);
  let credencialCp = await prisma.checkpoint.findFirst({
    where: { name: 'Acreditación y Entrega de Credencial' },
  });
  if (!credencialCp) {
    credencialCp = await prisma.checkpoint.create({
      data: {
        name: 'Acreditación y Entrega de Credencial',
        type: CheckpointType.credencial,
        day: day1Date,
        isActive: true,
      },
    });
  }

  let materialCp = await prisma.checkpoint.findFirst({
    where: { name: 'Entrega de Material y Carpeta' },
  });
  if (!materialCp) {
    materialCp = await prisma.checkpoint.create({
      data: {
        name: 'Entrega de Material y Carpeta',
        type: CheckpointType.material,
        day: day1Date,
        requiresCheckpointId: credencialCp.id,
        isActive: true,
      },
    });
  }

  // Puntos por día
  const days = [
    { num: 1, offset: 0 },
    { num: 2, offset: 1 },
    { num: 3, offset: 2 },
    { num: 4, offset: 3 },
  ];

  const createdCheckpoints = [credencialCp, materialCp];

  for (const { num, offset } of days) {
    const dayDate = getDayDate(offset);

    // Ingreso
    let ingresoCp = await prisma.checkpoint.findFirst({
      where: { name: `Ingreso Día ${num}` },
    });
    if (!ingresoCp) {
      ingresoCp = await prisma.checkpoint.create({
        data: {
          name: `Ingreso Día ${num}`,
          type: CheckpointType.ingreso,
          day: dayDate,
          requiresCheckpointId: num === 1 ? credencialCp.id : null,
          isActive: true,
        },
      });
    }
    createdCheckpoints.push(ingresoCp);

    // Refrigerio
    let refrigerioCp = await prisma.checkpoint.findFirst({
      where: { name: `Refrigerio Día ${num}` },
    });
    if (!refrigerioCp) {
      refrigerioCp = await prisma.checkpoint.create({
        data: {
          name: `Refrigerio Día ${num}`,
          type: CheckpointType.refrigerio,
          day: dayDate,
          requiresCheckpointId: ingresoCp.id,
          isActive: true,
        },
      });
    }
    createdCheckpoints.push(refrigerioCp);

    // Almuerzo
    let almuerzoCp = await prisma.checkpoint.findFirst({
      where: { name: `Almuerzo Día ${num}` },
    });
    if (!almuerzoCp) {
      almuerzoCp = await prisma.checkpoint.create({
        data: {
          name: `Almuerzo Día ${num}`,
          type: CheckpointType.almuerzo,
          day: dayDate,
          requiresCheckpointId: ingresoCp.id,
          isActive: true,
        },
      });
    }
    createdCheckpoints.push(almuerzoCp);
  }

  console.log(`✓ Puntos de control base verificados (${createdCheckpoints.length} puntos)`);

  // Asignar checkpoints del día 1 al operador de prueba
  if (operadorUser) {
    const day1Cps = createdCheckpoints.slice(0, 5);
    await prisma.userCheckpoint.deleteMany({ where: { userId: operadorUser.id } });
    await prisma.userCheckpoint.createMany({
      data: day1Cps.map((cp) => ({
        userId: operadorUser.id,
        checkpointId: cp.id,
      })),
    });
    console.log(`✓ Checkpoints iniciales asignados al operador (${day1Cps.length} puntos)`);
  }

  console.log('✨ Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('Error durante la ejecución del seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
