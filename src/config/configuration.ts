export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string;
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtl: string;
  };
  bcryptRounds: number;
  throttle: {
    ttlMs: number;
    limit: number;
    authLimit: number;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: required('JWT_REFRESH_SECRET'),
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    authLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '5', 10),
  },
});

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 16) {
    throw new Error(`Missing or weak env var: ${name} (min 16 chars)`);
  }
  return v;
}
