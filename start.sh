#!/usr/bin/env bash
set -e

echo "=== Render startup diagnostic ==="
echo "Node: $(node -v)"
echo "NODE_ENV=$NODE_ENV"
echo "PORT=$PORT"
echo "PWD=$(pwd)"
echo "ls dist/: $(ls dist/ 2>&1 | head -3)"
echo "DATABASE_URL=$(echo $DATABASE_URL | sed 's|://[^:]*:[^@]*@|://****:****@|')"

node -e "
const http = require('http');
const s = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type':'application/json'});
  res.end(JSON.stringify({
    ok: true,
    path: req.url,
    env: {
      NODE_ENV: process.env.NODE_ENV || '(unset)',
      PORT: process.env.PORT || '(unset)',
      API_PREFIX: process.env.API_PREFIX || '(unset)',
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DATABASE_URL_PREVIEW: String(process.env.DATABASE_URL).substring(0,20),
      JWT_ACCESS_SECRET_LEN: (process.env.JWT_ACCESS_SECRET || '').length,
      JWT_REFRESH_SECRET_LEN: (process.env.JWT_REFRESH_SECRET || '').length,
    }
  }));
});
const port = process.env.PORT || 10000;
s.listen(port, '0.0.0.0', () => {
  console.log('Test server listening on port ' + port);
});
"