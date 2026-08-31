const http = require('http');
const fs = require('fs');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
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
  const email = `verify-${Date.now()}@example.com`;
  const registered = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Verifier', email, password: 'secret123' })
  });
  fs.appendFileSync('api-verification.log', `REGISTER ${JSON.stringify(registered)}\n`);

  const token = registered.body.token;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const created = await request('/api/tasks', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ title: 'Verify Mongo persistence' })
  });
  fs.appendFileSync('api-verification.log', `POST ${JSON.stringify(created)}\n`);

  const list = await request('/api/tasks', { headers: { Authorization: `Bearer ${token}` } });
  fs.appendFileSync('api-verification.log', `GET ${JSON.stringify(list)}\n`);

  const id = created.body._id;
  const updated = await request(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ title: 'Updated task' })
  });
  fs.appendFileSync('api-verification.log', `PUT ${JSON.stringify(updated)}\n`);

  const deleted = await request(`/api/tasks/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  fs.appendFileSync('api-verification.log', `DELETE ${JSON.stringify(deleted)}\n`);

  const finalList = await request('/api/tasks', { headers: { Authorization: `Bearer ${token}` } });
  fs.appendFileSync('api-verification.log', `GET_AFTER_DELETE ${JSON.stringify(finalList)}\n`);
})();
