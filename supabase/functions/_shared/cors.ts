// @ts-nocheck

const LOCAL_DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const NON_PRODUCTION_ENV_VALUES = new Set([
  'local',
  'development',
  'dev',
  'test',
]);

const normalizeOrigin = (value: string): string => value.trim().replace(/\/+$/, '');

const getRuntimeEnvironment = (): string => (
  Deno.env.get('APP_ENV')
  || Deno.env.get('ENVIRONMENT')
  || Deno.env.get('NODE_ENV')
  || Deno.env.get('VERCEL_ENV')
  || 'development'
).trim().toLowerCase();

const isLocalLikeEnvironment = () => NON_PRODUCTION_ENV_VALUES.has(getRuntimeEnvironment());

const loadConfiguredOrigins = (): Set<string> => {
  const configured = String(Deno.env.get('CORS_ALLOWED_ORIGINS') ?? '').trim();
  if (!configured) {
    return new Set();
  }

  return new Set(
    configured
      .split(',')
      .map((origin) => normalizeOrigin(origin))
      .filter(Boolean),
  );
};

const resolveAllowedOrigin = (req: Request): string | null => {
  const originHeader = req.headers.get('origin');
  if (!originHeader) {
    return null;
  }

  const origin = normalizeOrigin(originHeader);
  const configuredOrigins = loadConfiguredOrigins();

  if (configuredOrigins.has(origin)) {
    return origin;
  }

  if (isLocalLikeEnvironment() && LOCAL_DEV_ORIGINS.has(origin)) {
    return origin;
  }

  return null;
};

export const createCorsHeaders = (
  req: Request,
  options?: {
    methods?: string;
    allowedHeaders?: string[];
  },
): Record<string, string> => {
  const allowedOrigin = resolveAllowedOrigin(req);
  const allowedHeaders = options?.allowedHeaders ?? [
    'authorization',
    'apikey',
    'content-type',
    'x-client-info',
  ];

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': allowedHeaders.join(', '),
    'Access-Control-Allow-Methods': options?.methods ?? 'POST, OPTIONS',
    Vary: 'Origin',
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }

  return headers;
};
