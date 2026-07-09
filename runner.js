const { spawn } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || 10000;
let appError = null;
let appRunning = false;
let appOutput = [];

// Test DB connection directly using pg (bundled with @prisma/client)
const { PrismaClient } = require('@prisma/client');

async function testDbDirect() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    appOutput.push(`[DB TEST] Direct Prisma connection OK: ${JSON.stringify(result)}\n`);
    await prisma.$disconnect();
    return true;
  } catch (err) {
    appOutput.push(`[DB TEST] Direct Prisma error: ${err.message}\n`);
    appOutput.push(`[DB TEST] errorCode: ${err.code || 'none'}\n`);
    try { await prisma.$disconnect(); } catch(e) {}
    return false;
  }
}

console.log('Testing DB connection directly...');
testDbDirect().then(dbOk => {
  appOutput.push(`[DB TEST] Result: ${dbOk}\n`);
  console.log('DB test complete, starting NestJS app...');
  const app = spawn('node', ['dist/main.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  app.stdout.on('data', (d) => { const t = d.toString(); appOutput.push(t); process.stdout.write(t); });
  app.stderr.on('data', (d) => { const t = d.toString(); appOutput.push(t); process.stderr.write(t); });
  app.on('error', (err) => { appError = err.message; console.error('Spawn error:', err); });
  app.on('exit', (code, signal) => { appRunning = false; appError = `exited code=${code} signal=${signal}`; console.error('App exited:', appError); });

  setTimeout(() => { appRunning = !appError; }, 5000);
});

const diag = () => ({
  app_running: appRunning,
  app_error: appError,
  app_output: appOutput.slice(-30),
  env: {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    API_PREFIX: process.env.API_PREFIX,
    DATABASE_URL: (process.env.DATABASE_URL || '').replace(/:[^:]*@/, ':****@'),
    JWT_ACCESS_SECRET_LEN: (process.env.JWT_ACCESS_SECRET || '').length,
    JWT_REFRESH_SECRET_LEN: (process.env.JWT_REFRESH_SECRET || '').length,
  },
});

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, path: req.url, ...diag() }, null, 2));
}).listen(PORT, '0.0.0.0', () => console.log('Runner on ' + PORT));
