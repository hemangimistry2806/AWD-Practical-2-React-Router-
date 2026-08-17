const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('taskdb');
  console.log('MONGO_URI=' + uri);

  const child = spawn(process.execPath, [path.join(__dirname, 'src', 'server', 'server.cjs')], {
    stdio: 'inherit',
    env: { ...process.env, MONGO_URI: uri }
  });

  child.on('exit', (code) => {
    mongod.stop().finally(() => process.exit(code || 0));
  });

  process.on('exit', () => child.kill());
})();
