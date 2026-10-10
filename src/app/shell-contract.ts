export interface PortalRoute {
  readonly compositionId: string;
  readonly globalPath: string;
  readonly basePath: string;
  readonly localPath: string;
  readonly query: Readonly<Record<string, readonly string[]>>;
  readonly fragment: string;
}

export interface SessionSnapshot {
  readonly state: 'resolving' | 'authenticated' | 'anonymous' | 'expired' | 'unavailable';
  readonly revision: number;
  readonly user: Readonly<{ id: string; name: string; roles: readonly string[] }> | null;
  readonly permissions: readonly string[];
  readonly expiresAt: string | null;
  readonly reason: 'NO_SESSION' | 'EXPIRED' | 'UNAUTHORIZED' | 'LOGOUT' | 'DEPENDENCY_UNAVAILABLE' | null;
}

export interface HttpRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly query?: Readonly<Record<string, readonly string[]>>;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly responseType?: 'json' | 'blob' | 'none';
  readonly signal?: AbortSignal;
}

export type HttpResult = Readonly<{
  ok: true; status: number; data: unknown; headers: Readonly<Record<string, string>>;
  correlationId: string;
}> | Readonly<{
  ok: false; status: number; error: string; message: string; details: unknown;
  traceId: string; correlationId: string;
  kind: 'http' | 'network' | 'timeout' | 'cancelled' | 'contract' | 'session';
  retryable: boolean;
}>;

export interface PortalContext {
  readonly contractVersion: 1;
  readonly portalId: 'billing';
  readonly mountId: string;
  readonly compositionId: string;
  readonly route: PortalRoute;
  readonly signal: AbortSignal;
  readonly navigation: {
    request(target: Readonly<{ path: string; replace?: boolean }>):
      Promise<Readonly<{ status: 'applied' | 'cancelled' | 'rejected' }>>;
  };
  readonly session: {
    getSnapshot(): SessionSnapshot;
    subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  };
  readonly http: { request(request: HttpRequest): Promise<HttpResult> };
  readonly reportFailure: (failure: Readonly<{
    code: 'PORTAL_RENDER_FAILED' | 'PORTAL_TASK_FAILED';
  }>) => void;
}

export interface PortalHandle {
  updateRoute(route: PortalRoute): Promise<void>;
  canLeave(): Promise<boolean>;
  unmount(): Promise<void>;
}
