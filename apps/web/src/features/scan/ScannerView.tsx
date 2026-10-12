'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  History,
  Keyboard,
  Loader2,
  Search,
  ShieldAlert,
  Undo2,
} from 'lucide-react';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';
import { apiErrorMessage } from '../../lib/api';
import { Alert, Button, Card, Field, Input, Spinner } from '../../components/ui/primitives';
import { checkpointTypeLabel, Checkpoint } from '../checkpoints/types';
import { feedbackForResult, unlockAudio } from './feedback';
import { ScanResultModal } from './ScanResultModal';
import { formatCode, normalizeCode, ScanPayload, scanApi } from './scan-api';
import { ScanOutcome, ScanResultValue, ScanSearchResult } from './types';

type Mode = 'camara' | 'codigo' | 'nombre';

interface HistoryEntry {
  id: string;
  name: string;
  result: ScanResultValue;
  color: string;
  at: string;
}

const COLOR_DOT: Record<string, string> = {
  verde: 'bg-status-ok',
  amarillo: 'bg-status-warning',
  rojo: 'bg-status-error',
};

/** Ignora la misma lectura repetida durante 3 s (el QR se lee muchas veces por segundo). */
function shouldIgnoreReading(code: string, last: { code: string; at: number }): boolean {
  const now = Date.now();
  if (last.code === code && now - last.at < 3000) return true;
  return false;
}

export interface ScannerViewProps {
  checkpoint: Checkpoint;
  /** `admin`: puede autorizar excepciones desde el resultado (RF-14). */
  canOverride: boolean;
}

export function ScannerView({ checkpoint, canOverride }: ScannerViewProps) {
  const [mode, setMode] = useState<Mode>('camara');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [startingCamera, setStartingCamera] = useState(false);
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScanSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const lastReadingRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  /** Último intento enviado, para poder autorizar una excepción sobre él. */
  const lastPayloadRef = useRef<Omit<ScanPayload, 'checkpointId'> | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      setCameraActive(false);
      return;
    }

    scannerRef.current = null;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // Si la cámara ya estaba detenida, no hay nada que hacer.
    }
    setCameraActive(false);
  }, []);

  const pushHistory = useCallback((scan: ScanOutcome) => {
    setHistory((previous) =>
      [
        {
          id: scan.id,
          name: scan.participant?.name ?? 'Sin identificar',
          result: scan.result,
          color: scan.color,
          at: scan.scannedAtLabel,
        },
        ...previous,
      ].slice(0, 6),
    );
  }, []);

  const submitScan = useCallback(
    async (payload: Omit<ScanPayload, 'checkpointId'>) => {
      setSending(true);
      setError(null);
      lastPayloadRef.current = payload;
      await stopCamera();

      try {
        const response = await scanApi.register({ ...payload, checkpointId: checkpoint.id });
        setOutcome(response);
        feedbackForResult(response.color);
        pushHistory(response);
        setCode('');
        setQuery('');
        setSearchResults([]);
      } catch (scanError) {
        setError(apiErrorMessage(scanError, 'No se pudo registrar el escaneo'));
      } finally {
        setSending(false);
      }
    },
    [checkpoint.id, stopCamera, pushHistory],
  );

  const startCamera = useCallback(async () => {
    if (scannerRef.current || startingCamera) return;

    setCameraError(null);
    setStartingCamera(true);
    unlockAudio();

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader', { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
        (decodedText) => {
          const normalized = normalizeCode(decodedText);
          if (normalized.length !== 6) return;
          if (shouldIgnoreReading(normalized, lastReadingRef.current)) return;
          lastReadingRef.current = { code: normalized, at: Date.now() };
          void submitScan({ code: normalized, source: 'qr' });
        },
        undefined,
      );

      setCameraActive(true);
    } catch (cameraStartError: any) {
      scannerRef.current = null;
      const message = String(cameraStartError?.message ?? cameraStartError ?? '');
      setCameraError(
        /NotAllowed|Permission|denied/i.test(message)
          ? 'El navegador no tiene permiso para usar la cámara. Habilítela en los ajustes del sitio (la cámara exige HTTPS). Mientras tanto use el código corto o la búsqueda por nombre.'
          : `No se pudo iniciar la cámara: ${message || 'dispositivo no disponible'}. Use el código corto o la búsqueda por nombre.`,
      );
    } finally {
      setStartingCamera(false);
    }
  }, [startingCamera, submitScan]);

  // Al entrar al punto se pide la cámara; al salir se libera siempre.
  useEffect(() => {
    void startCamera();
    return () => {
      void stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar/desmontar
  }, []);

  // Búsqueda por nombre con retardo corto.
  useEffect(() => {
    if (mode !== 'nombre') return;
    const text = query.trim();
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await scanApi.search(text, checkpoint.id);
        setSearchResults(response.data);
      } catch (searchError) {
        setError(apiErrorMessage(searchError, 'No se pudo buscar participantes'));
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [mode, query, checkpoint.id]);

  const changeMode = (next: Mode) => {
    setMode(next);
    setError(null);

    if (next === 'camara') {
      void startCamera();
    } else {
      void stopCamera();
      window.setTimeout(() => {
        if (next === 'codigo') codeInputRef.current?.focus();
        else searchInputRef.current?.focus();
      }, 60);
    }
  };

  const dismissResult = () => {
    setOutcome(null);
    if (mode === 'camara') void startCamera();
  };

  const handleOverride = async (reason: string) => {
    const payload = lastPayloadRef.current;

    if (!payload) {
      setOutcome(null);
      return;
    }

    setSending(true);
    try {
      const response = await scanApi.override({ ...payload, checkpointId: checkpoint.id, reason });
      setOutcome(response);
      feedbackForResult(response.color);
      pushHistory(response);
    } catch (overrideError) {
      setOutcome(null);
      setError(apiErrorMessage(overrideError, 'No se pudo autorizar la excepción'));
    } finally {
      setSending(false);
    }
  };

  const submitManualCode = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeCode(code);

    if (normalized.length !== 6) {
      setError('El código corto tiene 6 caracteres (sin 0, O, 1, I, L, U).');
      return;
    }

    void submitScan({ code: normalized, source: 'manual' });
  };

  /** Anulación de un escaneo por error (RF-15): solo administradores. */
  const voidScan = async (entry: HistoryEntry) => {
    const reason = window.prompt(
      `Motivo para anular el registro de ${entry.name}:`,
      'Escaneo registrado por error',
    );
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError('El motivo de la anulación debe ser más descriptivo.');
      return;
    }

    setVoidingId(entry.id);
    setError(null);
    setNotice(null);

    try {
      const response = await scanApi.voidScan(entry.id, reason.trim());
      setHistory((previous) =>
        previous.map((item) =>
          item.id === entry.id ? { ...item, result: 'anulado' as ScanResultValue, color: 'amarillo' } : item,
        ),
      );
      setNotice(response.message ?? 'Escaneo anulado. La persona puede registrarse de nuevo en este punto.');
    } catch (voidError) {
      setError(apiErrorMessage(voidError, 'No se pudo anular el escaneo'));
    } finally {
      setVoidingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <Link href="/scan" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700">
          <ArrowLeft className="w-4 h-4" />
          Cambiar punto
        </Link>

        <div className="text-right">
          <div className="text-sm font-semibold text-gray-900">{checkpoint.name}</div>
          <div className="text-xs text-gray-500">
            {checkpointTypeLabel(checkpoint.type)} · {checkpoint.windowLabel}
          </div>
        </div>
      </div>

      {/* Modos de registro */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { id: 'camara', label: 'Cámara', icon: Camera },
            { id: 'codigo', label: 'Código', icon: Keyboard },
            { id: 'nombre', label: 'Nombre', icon: Search },
          ] as Array<{ id: Mode; label: string; icon: typeof Camera }>
        ).map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeMode(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 min-h-[64px] rounded-2xl border text-sm font-semibold transition-colors ${
                active
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {sending && (
        <Alert variant="info">
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Registrando…
          </span>
        </Alert>
      )}

      {mode === 'camara' && (
        <Card className="overflow-hidden">
          <div id="qr-reader" className="w-full bg-black min-h-[240px]" />

          {!cameraActive && (
            <div className="p-4 space-y-3">
              {cameraError ? (
                <Alert variant="warning">{cameraError}</Alert>
              ) : (
                <p className="text-sm text-gray-600">
                  Apunte la cámara al código QR de la credencial. El registro se envía solo.
                </p>
              )}
              <Button type="button" onClick={() => void startCamera()} loading={startingCamera} className="w-full">
                <Camera className="w-4 h-4" />
                {cameraError ? 'Reintentar cámara' : 'Iniciar cámara'}
              </Button>
            </div>
          )}

          {cameraActive && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-200">
              <span className="text-xs text-gray-500">Leyendo códigos QR…</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => void stopCamera()}>
                <CameraOff className="w-4 h-4" />
                Detener
              </Button>
            </div>
          )}
        </Card>
      )}

      {mode === 'codigo' && (
        <Card className="p-4 space-y-4">
          <form onSubmit={submitManualCode} className="space-y-3">
            <Field
              label="Código corto de la credencial"
              hint="6 caracteres, por ejemplo K7P-3Q9. No distingue mayúsculas y admite el guion."
            >
              <Input
                ref={codeInputRef}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="K7P-3Q9"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="text-center font-mono text-3xl tracking-[0.3em] min-h-[64px]"
              />
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={sending}>
              Registrar
            </Button>
          </form>

          {code.length >= 6 && (
            <p className="text-center text-sm text-gray-500">
              Se enviará <span className="font-mono font-semibold">{formatCode(code)}</span>
            </p>
          )}
        </Card>
      )}

      {mode === 'nombre' && (
        <Card className="p-4 space-y-4">
          <Field label="Buscar participante" hint="Escriba el nombre o el apellido; también acepta el código.">
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ej. Ana Quispe"
              autoComplete="off"
            />
          </Field>

          {searching && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Spinner className="w-4 h-4" /> Buscando…
            </div>
          )}

          {!searching && query.trim().length >= 2 && searchResults.length === 0 && (
            <p className="text-sm text-gray-500">Sin coincidencias. Revise la escritura del nombre.</p>
          )}

          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
            {searchResults.map((participant) => (
              <li key={participant.id}>
                <button
                  type="button"
                  onClick={() => void submitScan({ participantId: participant.id, source: 'busqueda' })}
                  disabled={sending}
                  className="w-full text-left px-4 py-3 hover:bg-primary-50 transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-gray-900">{participant.name}</div>
                  <div className="text-xs text-gray-500">
                    {participant.roleLabel}
                    {participant.school ? ` · ${participant.school}` : ''}
                    {participant.committeeShort ? ` · ${participant.committeeShort}` : ''}
                  </div>
                  <div className="mt-0.5 font-mono text-sm text-gray-700">{formatCode(participant.code)}</div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canOverride && (
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <ShieldAlert className="w-4 h-4" />
          Como administrador puede autorizar excepciones desde la pantalla de resultado.
        </p>
      )}

      {history.length > 0 && (
        <Card className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <History className="w-4 h-4" />
            Últimos registros de esta sesión
          </h2>
          <ul className="mt-2 space-y-1.5">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[entry.color] ?? 'bg-gray-400'}`} />
                  <span className="truncate text-gray-900">{entry.name}</span>
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-xs text-gray-500">
                    {entry.result.replace(/_/g, ' ')} · {entry.at}
                  </span>
                  {canOverride && entry.result !== 'anulado' && (
                    <button
                      type="button"
                      onClick={() => void voidScan(entry)}
                      disabled={voidingId === entry.id}
                      title="Anular este escaneo (queda en auditoría)"
                      aria-label="Anular este escaneo"
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      {voidingId === entry.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Undo2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {outcome && (
        <ScanResultModal
          key={outcome.id}
          outcome={outcome}
          onDismiss={dismissResult}
          onOverride={canOverride ? handleOverride : undefined}
          autoDismissMs={outcome.color === 'verde' ? 1800 : 2600}
        />
      )}
    </div>
  );
}
