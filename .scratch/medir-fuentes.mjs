// Mide con pdf-lib (misma fuente y misma lógica que badge-pdf.service.ts)
import { createRequire } from 'node:module';
const require = createRequire('D:/DESARROLLO/NESTJS/asmun-control/apps/api/package.json');
const { PDFDocument, StandardFonts } = require('pdf-lib');

const pdf = await PDFDocument.create();
const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

const CM = 28.3465;
const CARD_WIDTH = 7.5 * CM; // 212.6 pt
const MARGIN_SIDE = 16;
const CONTENT_WIDTH = CARD_WIDTH - MARGIN_SIDE * 2; // 180.6 pt
const NAME_WIDTH = CONTENT_WIDTH;
const POSITION_WIDTH = CARD_WIDTH - 46 - MARGIN_SIDE;

/** Copia exacta del método fitFont del servicio. */
function fitFont(font, text, maxWidth, preferred, min) {
  if (!text) return preferred;
  let size = preferred;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

const committees = [
  'Consejo de Seguridad',
  'Asamblea General',
  'Comité de Derechos Humanos',
  'Corte Internacional de Justicia',
  'Organización Mundial de la Salud',
  'Organización de las Naciones Unidas',
  'Fondo de las Naciones Unidas para la Infancia',
  'Programa de las Naciones Unidas para el Medio Ambiente',
];
const countries = [
  'Bolivia',
  'Chile',
  'Brasil',
  'Estados Unidos de América',
  'Reino Unido de Gran Bretaña e Irlanda del Norte',
  'República Bolivariana de Venezuela',
];

const combos = [
  [12, 8],
  [13, 8],
  [14, 9],
  [15, 9],
  [16, 10],
];

console.log(`Ancho de tarjeta: ${CARD_WIDTH.toFixed(1)} pt · ancho útil de texto: ${CONTENT_WIDTH.toFixed(1)} pt\n`);

const show = (title, items, font, preferredNow) => {
  console.log(`── ${title} ──`);
  console.log(`texto`.padEnd(52), `ancho@${preferredNow}`, combos.map(([p, m]) => `pref${p}/min${m}`).join('  '));
  for (const text of items) {
    const w = font.widthOfTextAtSize(text, preferredNow);
    const row = combos.map(([p, m]) => `${fitFont(font, text, CONTENT_WIDTH, p, m).toFixed(1)}`.padStart(9));
    console.log(text.padEnd(52), `${w.toFixed(1)}`.padStart(9), '  ', row.join('  '));
  }
  console.log('');
};

show('COMITÉ (Helvetica regular 12 / min 8 actual)', committees, helvetica, 12);
show('PAÍS (Helvetica regular 12 / min 8 actual)', countries, helvetica, 12);
show('NOMBRE COMPLETO (referencia: Helvetica Bold 16 / min 9)', ['Ana María Quispe Mamani', 'Luis Fernández Rojas'], helveticaBold, 16);

// Espacio vertical disponible (y = línea base)
console.log('── Espacio vertical ──');
const COMMITTEE_Y = 228, NAME_Y = 196, COUNTRY_Y = 167, QR_TOP = 46 + 94 + 5, HEADER_BOTTOM = 256.3;
for (const size of [12, 14, 15, 16]) {
  const capTop = size * 0.72, desc = size * 0.21;
  console.log(
    `tamaño ${size}: comité techo ${(COMMITTEE_Y + capTop).toFixed(1)} (límite franja ${HEADER_BOTTOM}) · ` +
      `país base ${(COUNTRY_Y - desc).toFixed(1)} (placa QR hasta ${QR_TOP})`,
  );
}
console.log(`cargo (ancho útil ${POSITION_WIDTH.toFixed(1)} pt) "Docente asesor" -> ${fitFont(helveticaBold, 'Docente asesor', POSITION_WIDTH, 12, 7).toFixed(1)} pt`);
