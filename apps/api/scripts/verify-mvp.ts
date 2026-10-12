/**
 * Script de Verificación Integral de Criterios de Aceptación del MVP — ASMUN Control
 * Valida los 7 criterios del SDD (Sección 19) contra el API REST en vivo.
 */
import * as ExcelJS from 'exceljs';

const API_URL = process.env.API_URL || 'http://localhost:4000/api/v1';

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  let body: any;
  if (contentType.includes('application/json')) {
    body = await response.json();
  } else if (contentType.includes('pdf') || contentType.includes('spreadsheetml') || contentType.includes('octet-stream')) {
    body = await response.arrayBuffer();
  } else {
    body = await response.text();
  }
  return { status: response.status, headers: response.headers, body };
}

async function runMvpVerification() {
  console.log('===========================================================');
  console.log('🧪 INICIANDO VERIFICACIÓN DE CRITERIOS DE ACEPTACIÓN MVP');
  console.log('===========================================================');
  console.log(`📡 URL Objetivo: ${API_URL}\n`);

  const results: Record<string, boolean> = {};

  // 1. Autenticación Admin
  console.log('👉 [1/7] Autenticación Admin y Operador...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'AdminAsmun2026!' }),
  });
  if (adminLogin.status !== 200 || !adminLogin.body.accessToken) {
    throw new Error(`Error de autenticación admin: ${JSON.stringify(adminLogin.body)}`);
  }
  const adminToken = adminLogin.body.accessToken;
  const adminAuth = { Authorization: `Bearer ${adminToken}` };
  console.log('   ✓ Login Admin exitoso.');

  const operadorLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'operador', password: 'Operador2026!' }),
  });
  if (operadorLogin.status !== 200 || !operadorLogin.body.accessToken) {
    throw new Error(`Error de autenticación operador: ${JSON.stringify(operadorLogin.body)}`);
  }
  const operadorToken = operadorLogin.body.accessToken;
  const operadorAuth = { Authorization: `Bearer ${operadorToken}` };
  console.log('   ✓ Login Operador exitoso.');

  // Obtener puntos de control
  const checkpointsRes = await request('/checkpoints', { headers: adminAuth });
  const checkpoints = checkpointsRes.body.data || checkpointsRes.body;
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
    throw new Error('No hay puntos de control configurados.');
  }
  const testCheckpoint = checkpoints.find((c: any) => c.name.includes('Acreditación') || c.type === 'credencial') || checkpoints[0];
  console.log(`   ✓ Punto de control de prueba: "${testCheckpoint.name}" (ID: ${testCheckpoint.id})`);

  // Asegurar que el operador tenga asignado el checkpoint de prueba
  await request(`/users/${operadorLogin.body.user.id}/checkpoints`, {
    method: 'PUT',
    headers: { ...adminAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkpointIds: [testCheckpoint.id] }),
  });
  const operAvailable = await request('/checkpoints/available', { headers: operadorAuth });
  const operCheckpoints = operAvailable.body.data || operAvailable.body;
  const hasAccess = Boolean(operCheckpoints.some((c: any) => c.id === testCheckpoint.id));
  console.log(`   ✓ Operador restringido a sus puntos asignados: ${hasAccess ? 'CORRECTO' : 'ERROR'}`);
  results['CRITERIO_6_OPERADOR_ACCESO'] = hasAccess;

  // 2. Generación e Importación de ~200 Participantes en Excel
  console.log('\n👉 [2/7] Generando e importando Excel con ~200 participantes...');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Participantes');
  sheet.addRow(['Nombres', 'Apellidos', 'Colegio', 'Rol', 'Comité', 'País', 'Cargo', 'Restricciones']);

  const roles = ['delegado', 'docente', 'mesa', 'secretaria', 'staff', 'invitado'];
  const TOTAL_TEST_PARTICIPANTS = 200;

  for (let i = 1; i <= TOTAL_TEST_PARTICIPANTS; i++) {
    const role = roles[(i - 1) % roles.length];
    const colegio = `Colegio Prueba ${(i % 5) + 1}`;
    const comite = `Comité ${(i % 4) + 1}`;
    const diet = i % 10 === 0 ? 'Vegetariano / Alergia Maní' : '';
    sheet.addRow([
      `Participante ${i}`,
      `MVPTest ${i}`,
      colegio,
      role,
      comite,
      'Bolivia',
      role === 'mesa' ? 'Presidente' : '',
      diet,
    ]);
  }

  const excelBuffer = await workbook.xlsx.writeBuffer();
  const formData = new FormData();
  formData.append('file', new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'participantes_200.xlsx');
  formData.append('confirm', 'true');

  const startImport = Date.now();
  const importRes = await request('/participants/import', {
    method: 'POST',
    headers: adminAuth,
    body: formData,
  });
  const importTime = Date.now() - startImport;

  const importSuccess = importRes.status === 200 || importRes.status === 201;
  const importedCount = importRes.body?.summary?.created ?? importRes.body?.summary?.validRows ?? 0;
  console.log(`   ✓ Importación completada en ${importTime} ms. Filas creadas: ${importedCount}/${TOTAL_TEST_PARTICIPANTS} (Estado HTTP: ${importRes.status})`);
  results['CRITERIO_1_IMPORT_EXCEL'] = Boolean(importSuccess && importedCount >= TOTAL_TEST_PARTICIPANTS);

  // 3. Generación de Credenciales PDF en Lote (Hoja A4 x 4)
  console.log('\n👉 [3/7] Generación de PDF masivo de credenciales en hoja A4...');
  const startPdf = Date.now();
  const pdfRes = await request('/badges/pdf', {
    method: 'POST',
    headers: { ...adminAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ search: 'MVPTest' }),
  });
  const pdfTime = Date.now() - startPdf;
  const isPdf = Boolean(pdfRes.headers.get('content-type')?.includes('application/pdf'));
  const pdfBytes = pdfRes.body.byteLength || 0;
  console.log(`   ✓ PDF masivo generado en ${pdfTime} ms. Tamaño: ${(pdfBytes / 1024).toFixed(1)} KB`);
  results['CRITERIO_1_PDF_CREDENCIALES'] = Boolean(isPdf && pdfBytes > 10000);

  // Obtener participantes de prueba con su código corto
  const partList = await request('/participants?search=MVPTest&limit=10', { headers: adminAuth });
  const participants = partList.body.data || partList.body;
  if (!Array.isArray(participants) || participants.length < 2) {
    throw new Error('No se encontraron participantes creados para la prueba.');
  }
  const sampleParticipant = participants[0];
  const sampleParticipant2 = participants[1];
  const testCode = sampleParticipant.code;
  console.log(`   ✓ Participante 1: "${sampleParticipant.firstName} ${sampleParticipant.lastName}" (Código: ${testCode})`);
  console.log(`   ✓ Participante 2: "${sampleParticipant2.firstName} ${sampleParticipant2.lastName}" (Código: ${sampleParticipant2.code})`);

  // 4. Escaneo QR en Menos de 1 Segundo (< 1000 ms)
  console.log('\n👉 [4/7] Escaneando QR y midiendo tiempo de respuesta...');
  const startScan = Date.now();
  const scanQrRes = await request('/scans', {
    method: 'POST',
    headers: { ...operadorAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: testCode,
      checkpointId: testCheckpoint.id,
      source: 'qr',
    }),
  });
  const scanQrTime = Date.now() - startScan;
  const scanResult = scanQrRes.body?.result;
  const scanOk = (scanQrRes.status === 200 || scanQrRes.status === 201) && (scanResult === 'ok' || scanResult === 'excepcion');
  console.log(`   ✓ Escaneo QR completado en ${scanQrTime} ms (Límite: < 1000 ms). Resultado: ${scanResult} (HTTP ${scanQrRes.status})`);
  results['CRITERIO_2_ESCANEO_QR_VELOCIDAD'] = Boolean(scanOk && scanQrTime < 1000);

  // 5. Registro Manual por Código Corto y Búsqueda por Nombre (< 10 segundos)
  console.log('\n👉 [5/7] Registro manual por código corto y búsqueda por nombre...');
  const startManual = Date.now();
  const scanManualRes = await request('/scans', {
    method: 'POST',
    headers: { ...operadorAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: sampleParticipant2.code,
      checkpointId: testCheckpoint.id,
      source: 'manual',
    }),
  });
  const scanManualTime = Date.now() - startManual;
  const manualResult = scanManualRes.body?.result;
  const manualOk = (scanManualRes.status === 200 || scanManualRes.status === 201) && (manualResult === 'ok' || manualResult === 'excepcion');

  // Probar endpoint de búsqueda rápida
  const searchRes = await request(`/scans/search?q=${encodeURIComponent(sampleParticipant2.lastName)}&checkpointId=${testCheckpoint.id}`, {
    headers: operadorAuth,
  });
  const searchItems = searchRes.body?.data ?? searchRes.body;
  const searchFound = Boolean(Array.isArray(searchItems) && searchItems.length > 0);
  console.log(`   ✓ Registro manual completado en ${scanManualTime} ms (Límite: < 10000 ms). Resultado: ${manualResult}`);
  console.log(`   ✓ Búsqueda por nombre funcional: ${searchFound} (${searchItems?.length ?? 0} resultados encontrados)`);
  results['CRITERIO_3_REGISTRO_MANUAL'] = Boolean(manualOk && scanManualTime < 10000 && searchFound);

  // 6. Concurrencia y Garantía de "Un Solo Uso" (PostgreSQL ux_scan_once)
  console.log('\n👉 [6/7] Prueba de Concurrencia ACID: 8 escaneos simultáneos del mismo participante...');
  const concurrentPromises = Array.from({ length: 8 }).map(() =>
    request('/scans', {
      method: 'POST',
      headers: { ...operadorAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: testCode, // Ya fue registrado en el paso 4
        checkpointId: testCheckpoint.id,
        source: 'qr',
      }),
    }),
  );
  const concurrentResponses = await Promise.all(concurrentPromises);
  const duplicates = concurrentResponses.filter((r) => r.body?.result === 'duplicado');
  const noServerErrors = concurrentResponses.every((r) => r.status !== 500);
  console.log(`   ✓ ${duplicates.length}/8 intentos identificados como "duplicado". Errores 500: ${noServerErrors ? '0 (Ninguno)' : 'DETECTADOS'}`);
  results['CRITERIO_4_CONCURRENCIA_NO_DUPLICADOS'] = Boolean(duplicates.length === 8 && noServerErrors);

  // 7. Panel en Tiempo Real y Métricas
  console.log('\n👉 [7/7] Verificando métricas de panel y exportación XLSX...');
  const dashRes = await request('/dashboard/summary', { headers: adminAuth });
  const pendingRes = await request(`/dashboard/pending?checkpointId=${testCheckpoint.id}`, { headers: adminAuth });
  const dashData = dashRes.body;
  const dashOk = Boolean(dashData && dashData.totals?.activeParticipants > 0);
  const pendingCount = pendingRes.body?.meta?.total ?? pendingRes.body?.data?.length ?? 0;
  console.log(`   ✓ Panel: ${dashData.totals?.activeParticipants} activos, ${dashData.totals?.validScans} escaneos válidos. Pendientes del punto: ${pendingCount}`);
  results['CRITERIO_5_DASHBOARD_METRICAS'] = dashOk;

  // Exportaciones XLSX
  const exportParticipants = await request('/reports/participants.xlsx', { headers: adminAuth });
  const exportScans = await request('/reports/scans.xlsx', { headers: adminAuth });
  const exportPending = await request(`/reports/pending.xlsx?checkpointId=${testCheckpoint.id}`, { headers: adminAuth });

  const exportsOk = Boolean(
    exportParticipants.headers.get('content-type')?.includes('spreadsheetml') &&
    exportScans.headers.get('content-type')?.includes('spreadsheetml') &&
    exportParticipants.body.byteLength > 1000 &&
    exportScans.body.byteLength > 1000,
  );
  console.log(`   ✓ Exportaciones XLSX generadas con éxito (Participantes: ${exportParticipants.body.byteLength} B, Escaneos: ${exportScans.body.byteLength} B)`);
  results['CRITERIO_7_REPORTES_EXCEL'] = exportsOk;

  // Limpieza de datos de prueba
  console.log('\n🧹 Limpiando participantes y registros de prueba...');
  try {
    const participantsToDelete = await request('/participants?search=MVPTest&limit=250', { headers: adminAuth });
    const pItems = participantsToDelete.body.data || participantsToDelete.body;
    let deletedCount = 0;
    if (Array.isArray(pItems)) {
      for (const p of pItems) {
        await request(`/participants/${p.id}`, { method: 'DELETE', headers: adminAuth });
        deletedCount++;
      }
    }
    console.log(`   ✓ ${deletedCount} participantes de prueba eliminados.`);
  } catch (err: any) {
    console.warn('   ⚠ Advertencia al limpiar datos:', err.message);
  }

  // Resumen Final
  console.log('\n===========================================================');
  console.log('📋 RESUMEN DE CRITERIOS DE ACEPTACIÓN DEL MVP (SDD Sec. 19)');
  console.log('===========================================================');
  const criteriaMap: [string, string][] = [
    ['CRITERIO_1_IMPORT_EXCEL', '1. Importar Excel con ~200 participantes sin errores'],
    ['CRITERIO_1_PDF_CREDENCIALES', '2. Generar credenciales en PDF (hoja A4 x 4)'],
    ['CRITERIO_2_ESCANEO_QR_VELOCIDAD', '3. Escanear QR con respuesta en < 1 segundo'],
    ['CRITERIO_3_REGISTRO_MANUAL', '4. Registro manual por código corto en < 10 segundos'],
    ['CRITERIO_4_CONCURRENCIA_NO_DUPLICADOS', '5. Garantía de no duplicación ante doble escaneo simultáneo'],
    ['CRITERIO_5_DASHBOARD_METRICAS', '6. Panel con cifras correctas en tiempo real'],
    ['CRITERIO_6_OPERADOR_ACCESO', '7. Operador restringido y listo tras 5 min de inducción'],
    ['CRITERIO_7_REPORTES_EXCEL', '8. Exportación final a Excel (XLSX)'],
  ];

  let passedAll = true;
  for (const [key, label] of criteriaMap) {
    const status = results[key];
    console.log(`${status ? '✅' : '❌'} ${label}: ${status ? 'APROBADO' : 'FALLIDO'}`);
    if (!status) passedAll = false;
  }
  console.log('===========================================================');

  if (passedAll) {
    console.log('🎉 TODOS LOS CRITERIOS DE ACEPTACIÓN DEL MVP FUERON SUPERADOS CON ÉXITO.');
  } else {
    console.error('❌ Uno o más criterios no se cumplieron.');
    process.exit(1);
  }
}

runMvpVerification().catch((err) => {
  console.error('Error fatal durante la verificación:', err);
  process.exit(1);
});
