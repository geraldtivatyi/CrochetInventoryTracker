import net from 'net';

const host = process.env.DB_HOST || process.env.DB || 'db';
const port = Number(process.env.DB_PORT || 5432);

const tryConnect = () =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });

process.stdout.write(`Waiting for DB ${host}:${port}`);
while (!(await tryConnect())) {
  process.stdout.write('.');
  await new Promise((r) => setTimeout(r, 500));
}
console.log('\nDB is ready');
