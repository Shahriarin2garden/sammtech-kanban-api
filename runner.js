const { spawn } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || 10000;
let appError = null;
let appRunning = false;
let appOutput = [];

console.log('Starting NestJS app (dist/main.js)...');
const app = spawn('node', ['dist/main.js'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});

app.stdout.on('data', (d) => { const t = d.toString(); appOutput.push(t); process.stdout.write(t); });
app.stderr.on('data', (d) => { const t = d.toString(); appOutput.push('[STDERR] ' + t); process.stderr.write(t); });
app.on('error', (err) => { appError = err.message; console.error('Spawn error:', err); });
app.on('exit', (code, signal) => { appRunning = false; appError = `exited code=${code} signal=${signal}`; console.error('App exited:', appError); });

setTimeout(() => { appRunning = !appError; }, 5000);

const diag = () => ({
  app_running: appRunning,
  app_error: appError,
  app_output: appOutput.slice(-30),
  env: {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    API_PREFIX: process.env.API_PREFIX,
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DATABASE_URL_PREVIEW: (process.env.DATABASE_URL || '').substring(0,30),
    JWT_ACCESS_SECRET_LEN: (process.env.JWT_ACCESS_SECRET || '').length,
    JWT_REFRESH_SECRET_LEN: (process.env.JWT_REFRESH_SECRET || '').length,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  },
});

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, path: req.url, ...diag() }, null, 2));
}).listen(PORT, '0.0.0.0', () => console.log('Runner on ' + PORT));