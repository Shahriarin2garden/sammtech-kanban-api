const http = require('http');
const PORT = process.env.PORT || 10000;

const s = http.createServer((req, res) => {
  const data = {
    ok: true,
    path: req.url,
    node: process.version,
    env: {
      PORT: process.env.PORT || '(unset)',
      NODE_ENV: process.env.NODE_ENV || '(unset)',
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DATABASE_URL_PREVIEW: (process.env.DATABASE_URL || '').substring(0, 30),
      JWT_ACCESS_SECRET_LEN: (process.env.JWT_ACCESS_SECRET || '').length,
      JWT_REFRESH_SECRET_LEN: (process.env.JWT_REFRESH_SECRET || '').length,
    },
  };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
});

s.listen(PORT, '0.0.0.0', () => {
  console.log('Diagnostic server listening on ' + PORT);
});
