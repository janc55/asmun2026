export interface ApiError {
  code: string;
  message: string | string[];
}

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
    return localStorage.getItem('asmun_access_token');
  }

  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${cleanEndpoint}`;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(options.headers as HeadersInit);

    // Solo se declara JSON cuando el cuerpo es JSON. Con `FormData` el
    // `Content-Type` debe ponerlo el navegador para incluir el `boundary` del
    // multipart; si se fuerza `application/json`, el servidor intenta parsear el
    // archivo como JSON y responde 400 ("... is not valid JSON").
    if (!headers.has('Content-Type') && !isFormData(options.body)) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(this.buildUrl(endpoint), {
      ...options,
      headers,
    });

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
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(this.buildUrl(endpoint), { ...options, headers });

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
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(this.buildUrl(endpoint), { method: 'GET', headers });

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
