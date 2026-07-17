(function () {
  const bootLog = document.getElementById('boot-log');
  const joinForm = document.getElementById('join-form');
  const nicknameInput = document.getElementById('nickname');
  const roomInput = document.getElementById('roomcode');
  const genRoomBtn = document.getElementById('gen-room');

  const screenBoot = document.getElementById('screen-boot');
  const screenChat = document.getElementById('screen-chat');
  const roomLabel = document.getElementById('room-label');
  const userCount = document.getElementById('user-count');
  const userList = document.getElementById('user-list');
  const log = document.getElementById('log');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');
  const copyInviteBtn = document.getElementById('copy-invite');

  const BOOT_LINES = [
    'initializing rootchat kernel...',
    'spoofing MAC address... done',
    'bypassing firewall subsystem... done',
    'negotiating AES-256 tunnel... done',
    'connection encrypted. trace risk: low',
    'awaiting operator credentials_',
  ];

  function typeLine(text, cls) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'line' + (cls ? ' ' + cls : '');
      bootLog.appendChild(el);
      let i = 0;
      const interval = setInterval(() => {
        el.textContent = text.slice(0, i + 1);
        i++;
        if (i >= text.length) {
          clearInterval(interval);
          setTimeout(resolve, 120);
        }
      }, 14);
    });
  }

  async function runBootSequence() {
    for (const line of BOOT_LINES) {
      await typeLine(line, line.includes('done') ? 'ok' : '');
    }
    joinForm.classList.remove('hidden');
    nicknameInput.focus();
  }

  function randomRoomCode() {
    return 'zion-' + Math.random().toString(36).slice(2, 7);
  }

  genRoomBtn.addEventListener('click', () => {
    roomInput.value = randomRoomCode();
  });

  const socket = io();

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nickname = nicknameInput.value.trim();
    const roomCode = roomInput.value.trim();
    if (!nickname || !roomCode) return;
    socket.emit('room:join', { nickname, roomCode });
  });

  function appendMessage({ text, cls, nickname, ts }) {
    const el = document.createElement('div');
    el.className = 'msg' + (cls ? ' ' + cls : '');

    if (ts) {
      const tsEl = document.createElement('span');
      tsEl.className = 'ts';
      tsEl.textContent = new Date(ts).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      el.appendChild(tsEl);
    }

    if (nickname) {
      const nickEl = document.createElement('span');
      nickEl.className = 'nick';
      nickEl.textContent = nickname + ':';
      el.appendChild(nickEl);
    }

    const textEl = document.createElement('span');
    textEl.textContent = text;
    el.appendChild(textEl);

    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function renderUsers(users) {
    userList.innerHTML = '';
    users.forEach((u) => {
      const el = document.createElement('div');
      el.className = 'user-entry';
      el.textContent = u;
      userList.appendChild(el);
    });
    userCount.textContent = `${users.length} online`;
  }

  let myNickname = '';

  socket.on('room:joined', ({ roomCode, nickname, users }) => {
    myNickname = nickname;
    screenBoot.classList.add('hidden');
    screenChat.classList.remove('hidden');
    roomLabel.textContent = `~/${roomCode}`;
    renderUsers(users);
    appendMessage({ text: `connected as ${nickname}. type /help for commands.`, cls: 'system' });
    messageInput.focus();
  });

  socket.on('system', ({ text, users }) => {
    appendMessage({ text, cls: 'system' });
    if (users) renderUsers(users);
  });

  socket.on('chat:message', ({ nickname, text, ts }) => {
    appendMessage({
      text,
      nickname,
      ts,
      cls: nickname === myNickname ? 'self' : '',
    });
  });

  socket.on('disconnect', () => {
    appendMessage({ text: 'connection lost. attempting to reconnect...', cls: 'error' });
  });

  socket.on('connect', () => {
    if (myNickname) {
      appendMessage({ text: 'connection re-established.', cls: 'system' });
    }
  });

  function runCommand(cmd) {
    const [name] = cmd.slice(1).split(' ');
    switch (name) {
      case 'help':
        appendMessage({
          text: 'commands: /help, /clear, /users, /whoami',
          cls: 'system',
        });
        break;
      case 'clear':
        log.innerHTML = '';
        break;
      case 'users':
        appendMessage({
          text: Array.from(userList.children).map((c) => c.textContent).join(', ') || 'nobody here',
          cls: 'system',
        });
        break;
      case 'whoami':
        appendMessage({ text: myNickname, cls: 'system' });
        break;
      default:
        appendMessage({ text: `unknown command: ${name}`, cls: 'error' });
    }
  }

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = messageInput.value.trim();
    if (!value) return;
    messageInput.value = '';

    if (value.startsWith('/')) {
      runCommand(value);
      return;
    }
    socket.emit('chat:message', value);
  });

  copyInviteBtn.addEventListener('click', async () => {
    const room = roomLabel.textContent.replace('~/', '');
    const text = `join my rootchat: ${window.location.origin} — channel code: ${room}`;
    try {
      await navigator.clipboard.writeText(text);
      copyInviteBtn.textContent = 'COPIED';
      setTimeout(() => (copyInviteBtn.textContent = 'SHARE'), 1500);
    } catch {
      window.prompt('copy this invite:', text);
    }
  });

  runBootSequence();
})();
