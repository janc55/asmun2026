export interface ApiError {
  code: string;
  message: string | string[];
}

/** Claves de almacenamiento compartidas con el contexto de autenticación. */
export const AUTH_TOKEN_KEYS = {
  access: 'asmun_access_token',
  refresh: 'asmun_refresh_token',
} as const;

/**
 * El access token vence (8 h). Cuando eso pasa ya no se puede renovar con el
 * refresh token, el cliente borra la sesión y avisa por este evento para que el
 * contexto de React redirija al login.
 */
export const SESSION_EXPIRED_EVENT = 'asmun:session-expired';

const REFRESH_ENDPOINT = '/auth/refresh';

/** Rutas donde un 401 son credenciales inválidas, no un token vencido. */
const NO_REFRESH_ENDPOINTS = ['/auth/login', '/auth/refresh'];

/**
 * Renovación en curso. Varias peticiones pueden recibir 401 a la vez (por
 * ejemplo el listado y el conteo de participantes): todas comparten una única
 * llamada a `/auth/refresh` en lugar de disparar una por petición.
 */
let refreshInFlight: Promise<boolean> | null = null;

class ApiClient {
  private get baseUrl(): string {
    // En el navegador usa ruta relativa para beneficiarse de rewrites en Next.js o NEXT_PUBLIC_API_URL
    if (typeof window !== 'undefined') {
      return '/api/v1';
    }
    return process.env.API_URL ? `${process.env.API_URL}/api/v1` : 'http://localhost:4000/api/v1';
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(AUTH_TOKEN_KEYS.access);
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(AUTH_TOKEN_KEYS.refresh);
  }

  /** Cabeceras con el token vigente; se reconstruyen en cada intento. */
  private withAuthHeaders(options: RequestInit): RequestInit {
    const headers = new Headers(options.headers as HeadersInit);
    const token = this.getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return { ...options, headers };
  }

  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${cleanEndpoint}`;
  }

  /**
   * Ejecuta la petición y, si el access token venció (401), lo renueva con el
   * refresh token y reintenta **una sola vez**. Sin esto la sesión terminaba en
   * cuanto expiraba el token, porque el refresh token se guardaba pero no se
   * usaba nunca.
   */
  private async fetchWithAuth(endpoint: string, options: RequestInit): Promise<Response> {
    const response = await fetch(this.buildUrl(endpoint), this.withAuthHeaders(options));

    if (response.status !== 401 || this.skipsRefresh(endpoint)) return response;

    const renewed = await this.refreshSession();
    if (!renewed) {
      this.clearSession();
      return response;
    }

    return fetch(this.buildUrl(endpoint), this.withAuthHeaders(options));
  }

  private skipsRefresh(endpoint: string): boolean {
    return NO_REFRESH_ENDPOINTS.some((path) => endpoint.startsWith(path));
  }

  private refreshSession(): Promise<boolean> {
    if (!refreshInFlight) {
      refreshInFlight = this.performRefresh().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  /** `POST /auth/refresh`: guarda los tokens nuevos que emite el backend. */
  private async performRefresh(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(this.buildUrl(REFRESH_ENDPOINT), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = (await response.json().catch(() => null)) as
        | { accessToken?: string; refreshToken?: string }
        | null;

      if (!data?.accessToken) return false;

      localStorage.setItem(AUTH_TOKEN_KEYS.access, data.accessToken);
      localStorage.setItem(AUTH_TOKEN_KEYS.refresh, data.refreshToken ?? refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  /** Borra los tokens y avisa al contexto para que vuelva al login. */
  private clearSession(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_TOKEN_KEYS.access);
    localStorage.removeItem(AUTH_TOKEN_KEYS.refresh);
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers as HeadersInit);

    // Solo se declara JSON cuando el cuerpo es JSON. Con `FormData` el
    // `Content-Type` debe ponerlo el navegador para incluir el `boundary` del
    // multipart; si se fuerza `application/json`, el servidor intenta parsear el
    // archivo como JSON y responde 400 ("... is not valid JSON").
    if (!headers.has('Content-Type') && !isFormData(options.body)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await this.fetchWithAuth(endpoint, { ...options, headers });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error: ApiError = {
        code: data?.code || `HTTP_${response.status}`,
        message: data?.message || 'Error en la petición al servidor',
      };
      throw error;
    }

    return data as T;
  }

  /**
   * Peticiones que devuelven un archivo (PDF, XLSX). No se fija
   * `Content-Type` para que el navegador arme el `boundary` en multipart.
   */
  async requestBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
    const response = await this.fetchWithAuth(endpoint, options);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const error: ApiError = {
        code: data?.code || `HTTP_${response.status}`,
        message: data?.message || 'No se pudo obtener el archivo solicitado',
      };
      throw error;
    }

    return response.blob();
  }

  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  getBlob(endpoint: string): Promise<Blob> {
    return this.requestBlob(endpoint, { method: 'GET' });
  }

  /**
   * Descarga con acceso a las cabeceras de la respuesta (`Content-Disposition`
   * para el nombre del archivo y `X-Row-Count` para informar cuántas filas se
   * exportaron).
   */
  async getFile(endpoint: string): Promise<{ blob: Blob; headers: Headers }> {
    const response = await this.fetchWithAuth(endpoint, { method: 'GET' });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const error: ApiError = {
        code: data?.code || `HTTP_${response.status}`,
        message: data?.message || 'No se pudo generar el archivo',
      };
      throw error;
    }

    return { blob: await response.blob(), headers: response.headers };
  }

  postBlob(endpoint: string, body?: any): Promise<Blob> {
    return this.requestBlob(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** Subida de archivos: `FormData` viaja con el `Content-Type` del navegador. */
  postForm<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: formData });
  }
}

export const api = new ApiClient();

/** `true` cuando el cuerpo de la petición es un formulario multipart. */
function isFormData(body: unknown): boolean {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

/** Normaliza el mensaje de error de la API (puede llegar como lista). */
export function apiErrorMessage(error: any, fallback = 'Ocurrió un error inesperado'): string {
  const message = error?.message;
  if (Array.isArray(message)) return message.join('. ');
  if (typeof message === 'string' && message.length > 0) return message;
  return fallback;
}

/** Descarga un archivo ya obtenido de la API. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Abre el archivo en una pestaña nueva (por ejemplo, para imprimir la credencial). */
export function openBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
