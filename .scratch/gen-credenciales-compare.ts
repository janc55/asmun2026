import { writeFile } from 'node:fs/promises';
import { BadgePdfService, BadgeParticipant } from '../apps/api/src/badges/badge-pdf.service';

const participants: BadgeParticipant[] = [
  {
    id: 1,
    code: 'ABC234',
    firstName: 'Ana María',
    lastName: 'Quispe Mamani',
    role: 'delegado' as any,
    position: 'DELEGADO',
    country: 'Bolivia',
    school: { name: 'Colegio Americano de Oruro' },
    committee: { name: 'Consejo de Seguridad', shortName: 'CS' },
  },
  {
    id: 2,
    code: 'K7P3Q9',
    firstName: 'Luis',
    lastName: 'Fernández Rojas',
    role: 'docente' as any,
    position: 'DOCENTE ASESOR',
    country: 'Chile',
    school: { name: 'Colegio San Ignacio' },
    committee: { name: 'Asamblea General', shortName: 'AG' },
  },
  {
    id: 3,
    code: 'M4T8Z2',
    firstName: 'María José',
    lastName: 'Choque Lima',
    role: 'mesa' as any,
    position: 'MESA DIRECTIVA',
    country: 'Estados Unidos de América',
    school: { name: 'Colegio Americano de Oruro' },
    committee: { name: 'Organización Mundial de la Salud', shortName: 'OMS' },
  },
  {
    id: 4,
    code: 'R9V5B7',
    firstName: 'Pedro Antonio',
    lastName: 'Mamani Vargas',
    role: 'secretaria' as any,
    position: 'SECRETARÍA',
    country: 'Reino Unido de Gran Bretaña e Irlanda del Norte',
    school: { name: 'Colegio San Ignacio' },
    committee: { name: 'Fondo de las Naciones Unidas para la Infancia', shortName: 'UNICEF' },
  },
];

const event = { name: 'ASMUN 2026', subtitle: 'Colegio Americano de Oruro' };

/** Reproduce `fitFont` con otro valor preferido, para simular el tamaño anterior. */
function withPreferred(service: BadgePdfService, from: number, to: number): BadgePdfService {
  const original = (service as any).fitFont.bind(service);
  (service as any).fitFont = (text: string, font: any, maxWidth: number, preferred: number, min: number) =>
    original(text, font, maxWidth, preferred === from && min === 8 ? to : preferred, min);
  return service;
}

function report(label: string, preferred: number) {  console.log(`\n── ${label} (preferido ${preferred} pt, mínimo 8) ──`);
  participants.forEach((p) => {
    console.log(
      `  ${p.committee?.name}  →  comité ${measure(p.committee!.name, 180.6, preferred).toFixed(1)} pt · ` +
        `país ${measure(p.country!, 180.6, preferred).toFixed(1)} pt`,
    );
  });
}

// Métricas de Helvetica para informar los tamaños resultantes (misma fuente del PDF).
const { createRequire } = require('node:module') as any;
const req = createRequire('D:/DESARROLLO/NESTJS/asmun-control/apps/api/package.json');
const { PDFDocument, StandardFonts } = req('pdf-lib');
let helvetica: any;
function measure(text: string, maxWidth: number, preferred: number): number {
  let size = preferred;
  while (size > 8 && helvetica.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

/** Captura los tamaños realmente dibujados en el PDF. */
function spyDrawCentered(service: BadgePdfService): Map<string, number[]> {
  const seen = new Map<string, number[]>();
  const original = (service as any).drawCentered.bind(service);
  (service as any).drawCentered = (page: any, text: string, options: any) => {
    const list = seen.get(text) ?? [];
    list.push(options.size);
    seen.set(text, list);
    return original(page, text, options);
  };
  return seen;
}

(async () => {
  const pdf = await PDFDocument.create();
  helvetica = await pdf.embedFont(StandardFonts.Helvetica);

  const after = new BadgePdfService();
  const afterSizes = spyDrawCentered(after);
  const afterPdf = await after.render(participants, { sheet: 'a4', event });
  await writeFile('.scratch/credenciales-despues-14pt.pdf', afterPdf);

  const before = withPreferred(new BadgePdfService(), 14, 12);
  const beforeSizes = spyDrawCentered(before);
  const beforePdf = await before.render(participants, { sheet: 'a4', event });
  await writeFile('.scratch/credenciales-antes-12pt.pdf', beforePdf);

  const show = (label: string, sizes: Map<string, number[]>) => {
    console.log(`\n── ${label}: tamaños realmente dibujados ──`);
    participants.forEach((p) => {
      console.log(
        `  comité "${p.committee!.name}" → ${sizes.get(p.committee!.name)?.join(', ')} pt · ` +
          `país "${p.country}" → ${sizes.get(p.country!)?.join(', ')} pt`,
      );
    });
  };
  show('ANTES', beforeSizes);
  show('DESPUÉS', afterSizes);

  report('ANTES (cálculo equivalente)', 12);
  report('DESPUÉS (cálculo equivalente)', 14);
  console.log('\nPDFs: .scratch/credenciales-antes-12pt.pdf y .scratch/credenciales-despues-14pt.pdf');
})();
