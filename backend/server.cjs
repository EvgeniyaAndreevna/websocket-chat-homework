'use strict';

// Self-contained course-compatible backend. The original Netology repository
// was unavailable at build time; the protocol is documented in README.md.
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 7071);
const HOST = process.env.HOST || '0.0.0.0';
const users = new Map(); // WebSocket -> { id, name }

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ status: 'ok', users: users.size }));
    return;
  }
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('WebSocket Chat API running. Connect using /ws.');
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(payload) {
  for (const socket of users.keys()) send(socket, payload);
}

function publishUsers() {
  const list = [...users.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  broadcast({ type: 'users', users: list });
}

wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });

  socket.on('message', (buffer) => {
    let data;
    try { data = JSON.parse(buffer.toString('utf8')); }
    catch { return send(socket, { type: 'error', message: 'Ожидается JSON.' }); }
    if (!data || typeof data !== 'object') return;

    if (data.type === 'register') {
      if (users.has(socket)) return send(socket, { type: 'error', message: 'Вы уже вошли в чат.' });
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (name.length < 2 || name.length > 24) {
        return send(socket, { type: 'error', message: 'Никнейм должен содержать от 2 до 24 символов.' });
      }
      const normalizedName = name.toLocaleLowerCase('ru');
      if ([...users.values()].some((u) => u.name.toLocaleLowerCase('ru') === normalizedName)) {
        return send(socket, { type: 'name_taken', message: 'Этот никнейм уже занят. Выберите другой.' });
      }

      const user = { id: randomUUID(), name };
      users.set(socket, user);
      send(socket, { type: 'registered', user });
      publishUsers();
      broadcast({ type: 'notice', message: `${name} присоединился к чату`, created: Date.now() });
      return;
    }

    if (data.type === 'send') {
      const user = users.get(socket);
      if (!user) return send(socket, { type: 'error', message: 'Сначала зарегистрируйтесь.' });
      const message = typeof data.message === 'string' ? data.message.trim() : '';
      if (!message || message.length > 2000) {
        return send(socket, { type: 'error', message: 'Сообщение должно содержать от 1 до 2000 символов.' });
      }
      // The sender is always taken from the authenticated connection,
      // not from user supplied in the send payload.
      broadcast({ type: 'send', message, user, created: Date.now() });
      return;
    }

    send(socket, { type: 'error', message: 'Неизвестный тип сообщения.' });
  });

  socket.on('close', () => {
    const user = users.get(socket);
    if (user) {
      users.delete(socket);
      publishUsers();
      broadcast({ type: 'notice', message: `${user.name} покинул чат`, created: Date.now() });
    }
  });
  socket.on('error', (error) => console.error('WebSocket client error:', error.message));
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) { socket.terminate(); continue; }
    socket.isAlive = false;
    socket.ping();
  }
}, 30_000);

wss.on('close', () => clearInterval(heartbeat));
server.listen(PORT, HOST, () => {
  console.log(`WebSocket chat API: http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});
