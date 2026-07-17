const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 4004;
const MAX_MESSAGE_LENGTH = 500;
const MAX_NICK_LENGTH = 20;
const MAX_ROOM_LENGTH = 24;
const RATE_LIMIT_WINDOW_MS = 5000;
const RATE_LIMIT_MAX_MESSAGES = 15;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'public')));

// roomCode -> Map<socketId, nickname>
const rooms = new Map();

function sanitizeText(input, maxLen) {
  return String(input ?? '').trim().slice(0, maxLen);
}

function roomUsers(roomCode) {
  const room = rooms.get(roomCode);
  return room ? Array.from(room.values()) : [];
}

function isRateLimited(socket) {
  const now = Date.now();
  if (!socket.data.messageTimestamps) socket.data.messageTimestamps = [];
  socket.data.messageTimestamps = socket.data.messageTimestamps.filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (socket.data.messageTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) return true;
  socket.data.messageTimestamps.push(now);
  return false;
}

io.on('connection', (socket) => {
  socket.on('room:join', ({ nickname, roomCode } = {}) => {
    if (socket.data.roomCode) return; // already joined once per connection

    const nick =
      sanitizeText(nickname, MAX_NICK_LENGTH) || `ghost${Math.floor(Math.random() * 9999)}`;
    const room = sanitizeText(roomCode, MAX_ROOM_LENGTH).toLowerCase() || 'lobby';

    socket.data.nickname = nick;
    socket.data.roomCode = room;
    socket.join(room);

    if (!rooms.has(room)) rooms.set(room, new Map());
    rooms.get(room).set(socket.id, nick);

    socket.emit('room:joined', { roomCode: room, nickname: nick, users: roomUsers(room) });
    socket.to(room).emit('system', {
      text: `${nick} has joined the channel.`,
      users: roomUsers(room),
    });
  });

  socket.on('chat:message', (text) => {
    const room = socket.data.roomCode;
    const nick = socket.data.nickname;
    if (!room || !nick) return;
    if (isRateLimited(socket)) return;

    const clean = sanitizeText(text, MAX_MESSAGE_LENGTH);
    if (!clean) return;

    io.to(room).emit('chat:message', { nickname: nick, text: clean, ts: Date.now() });
  });

  socket.on('disconnect', () => {
    const room = socket.data.roomCode;
    const nick = socket.data.nickname;
    if (!room) return;

    const roomMap = rooms.get(room);
    if (roomMap) {
      roomMap.delete(socket.id);
      if (roomMap.size === 0) rooms.delete(room);
    }
    socket.to(room).emit('system', {
      text: `${nick} has disconnected.`,
      users: roomUsers(room),
    });
  });
});

server.listen(PORT, () => {
  console.log(`[rootchat] listening on port ${PORT}`);
});
