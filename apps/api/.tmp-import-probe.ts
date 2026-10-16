import * as ExcelJS from 'exceljs';
import { ParticipantsImportService } from './src/participants/import/participants-import.service';

const RICH = (text: string) => ({ richText: [{ text }] }) as any;

/** Planilla "del usuario": dos hojas, columnas opcionales vacías, encabezados con tildes. */
async function buildWorkbook(options: {
  helpFirst: boolean;
  headerMode: 'plain' | 'richText';
  withRoleData: boolean;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  const addData = () => {
    const sheet = wb.addWorksheet('Participantes');
    const headers = [
      'Nombres',
      'Apellidos',
      'Rol',
      'Colegio',
      'Ciudad',
      'Comité',
      'Sigla',
      'País',
    ];
    sheet.addRow(headers.map((h) => (options.headerMode === 'richText' ? RICH(h) : h)));
    sheet.addRow(['Ana María', 'Quispe Mamani', '', '', '', 'Consejo de Seguridad', '', 'Bolivia']);
    sheet.addRow(['Luis', 'Fernández Rojas', options.withRoleData ? 'docente' : '', '', '', 'Asamblea General', '', 'Chile']);
    return sheet;
  };

  const addHelp = () => {
    const sheet = wb.addWorksheet('Instrucciones');
    sheet.addRow(['Columna', 'Obligatoria', 'Encabezados aceptados']);
    sheet.addRow(['Nombres', 'Sí', 'nombre, nombres, nombre completo']);
    sheet.addRow(['Apellidos', 'Sí', 'apellido, apellidos']);
    sheet.addRow(['Rol', 'No', 'rol, tipo de participante']);
    return sheet;
  };

  if (options.helpFirst) {
    addHelp();
    addData();
  } else {
    addData();
    addHelp();
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function makeService() {
  const prisma: any = {
    school: { findMany: async () => [] },
    committee: { findMany: async () => [] },
    participant: { findMany: async () => [] },
  };
  const participants: any = { create: async (dto: any) => ({ id: 1, code: 'ABC234', ...dto }) };
  const schools: any = { ensureByName: async () => ({ id: 10, created: true }) };
  const committees: any = { ensureByName: async () => ({ id: 20, created: true }) };
  return new ParticipantsImportService(prisma, participants, schools, committees);
}

async function run(label: string, file: Buffer, options: any = {}) {
  const service = makeService();
  try {
    const report = await service.import(
      { buffer: file, originalname: 'planilla.xlsx', size: file.length },
      { confirm: false, createMissingCatalogs: true, ...options } as any,
    );
    console.log(`\n=== ${label} ===`);
    console.log('hoja leída      :', report.sheetName, '| fila encabezado:', report.headerRow);
    console.log('columnas        :', report.detectedColumns.map((c) => c.header).join(', ') || '—');
    console.log('ignoradas       :', report.unknownColumns.join(', ') || '—');
    console.log('resumen         :', JSON.stringify(report.summary));
    report.rows.forEach((r) =>
      console.log(`  fila ${r.row} [${r.status}] ${r.data.firstName} ${r.data.lastName} :: errores=${JSON.stringify(r.errors)} avisos=${JSON.stringify(r.warnings)}`),
    );
  } catch (error: any) {
    console.log(`\n=== ${label} ===`);
    console.log('EXCEPCIÓN', error?.status ?? '', JSON.stringify(error?.response ?? error?.message));
  }
}

(async () => {
  await run('A. Datos primero, Rol vacío en todas las filas (caso del usuario)', await buildWorkbook({ helpFirst: false, headerMode: 'plain', withRoleData: false }));
  await run('B. Igual, pero con rol lleno', await buildWorkbook({ helpFirst: false, headerMode: 'plain', withRoleData: true }));
  await run('C. Hoja "Instrucciones" primero', await buildWorkbook({ helpFirst: true, headerMode: 'plain', withRoleData: true }));
  await run('D. Encabezados con texto enriquecido (richText)', await buildWorkbook({ helpFirst: false, headerMode: 'richText', withRoleData: true }));
  await run('E. Rol vacío + rol por defecto enviado desde el frontend', await buildWorkbook({ helpFirst: false, headerMode: 'plain', withRoleData: false }), { defaultRole: 'delegado' });
  await run('F. Confirmación real (confirm=true) con rol vacío y colegio por defecto', await buildWorkbook({ helpFirst: false, headerMode: 'plain', withRoleData: false }), { confirm: true, defaultSchoolName: 'Colegio Americano de Oruro' });
})();
