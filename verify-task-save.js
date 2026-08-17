const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

function request(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: pathname,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

(async () => {
  const child = spawn(process.execPath, [path.join(__dirname, 'src', 'server', 'server.cjs')], {
    stdio: 'inherit',
    env: { ...process.env, MONGO_URI: 'mongodb://127.0.0.1:27017/taskdb' }
  });

  setTimeout(async () => {
    try {
      const created = await request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Verified Save Task' })
      });

      console.log('POST_RESULT', JSON.stringify(created));

      const list = await request('/api/tasks');
      console.log('GET_RESULT', JSON.stringify(list));

      child.kill();
      process.exit(created.status === 201 && list.status === 200 ? 0 : 1);
    } catch (err) {
      console.error('VERIFY_ERROR', err.message);
      child.kill();
      process.exit(1);
    }
  }, 2500);
})();
