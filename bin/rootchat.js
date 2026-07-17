#!/usr/bin/env node
'use strict';

const readline = require('readline');
const { io } = require('socket.io-client');

const GREEN = '\x1b[32m';
const BRIGHT_GREEN = '\x1b[92m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

const BANNER = `
${GREEN}██████╗  ██████╗  ██████╗ ████████╗ ██████╗██╗  ██╗ █████╗ ████████╗
██╔══██╗██╔═══██╗██╔═══██╗╚══██╔══╝██╔════╝██║  ██║██╔══██╗╚══██╔══╝
██████╔╝██║   ██║██║   ██║   ██║   ██║     ███████║███████║   ██║
██╔══██╗██║   ██║██║   ██║   ██║   ██║     ██╔══██║██╔══██║   ██║
██║  ██║╚██████╔╝╚██████╔╝   ██║   ╚██████╗██║  ██║██║  ██║   ██║
╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝${RESET}
`;

const BOOT_LINES = [
  'initializing rootchat kernel...',
  'spoofing MAC address... done',
  'bypassing firewall subsystem... done',
  'negotiating AES-256 tunnel... done',
  'connection encrypted. trace risk: low',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeLine(text) {
  process.stdout.write(DIM + GREEN);
  for (const ch of text) {
    process.stdout.write(ch);
    await sleep(8);
  }
  process.stdout.write(RESET + '\n');
}

function parseArgs(argv) {
  const args = { server: 'http://localhost:4004' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--server' || a === '-s') args.server = argv[++i];
    else if (a === '--nick' || a === '-n') args.nick = argv[++i];
    else if (a === '--room' || a === '-r') args.room = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`
${BOLD}rootchat${RESET} — terminal client, no browser needed

Usage: rootchat [options]

Options:
  -s, --server <url>   Server to connect to (default: http://localhost:4004)
  -n, --nick <name>    Handle to join as (skips prompt)
  -r, --room <code>    Channel code to join (skips prompt)
  -h, --help           Show this help

In-chat commands: /help  /clear  /users  /whoami  /quit
`);
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log(BANNER);
  for (const line of BOOT_LINES) {
    await typeLine(line);
  }
  console.log(`${GREEN}target: ${args.server}${RESET}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const nickname = args.nick || (await ask(rl, `${GREEN}HANDLE: ${RESET}`));
  const roomCode = args.room || (await ask(rl, `${GREEN}CHANNEL CODE: ${RESET}`));

  console.log(`${DIM}establishing connection...${RESET}`);

  const socket = io(args.server, { reconnectionDelay: 1000 });
  let myNickname = nickname;
  let currentUsers = [];
  let quitting = false;

  function printAbovePrompt(line) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(line);
    rl.prompt(true);
  }

  socket.on('connect_error', (err) => {
    console.error(`${RED}connection error: ${err.message}${RESET}`);
  });

  socket.on('connect', () => {
    socket.emit('room:join', { nickname, roomCode });
  });

  socket.on('room:joined', (data) => {
    myNickname = data.nickname;
    currentUsers = data.users;
    console.log(`${BRIGHT_GREEN}connected as ${data.nickname} in ~/${data.roomCode}${RESET}`);
    console.log(`${DIM}users online: ${currentUsers.join(', ')}${RESET}`);
    console.log(`${DIM}type /help for commands, /quit to exit${RESET}\n`);
    rl.setPrompt(`${GREEN}> ${RESET}`);
    rl.prompt();
  });

  socket.on('system', (data) => {
    if (data.users) currentUsers = data.users;
    printAbovePrompt(`${DIM}* ${data.text}${RESET}`);
  });

  socket.on('chat:message', (data) => {
    const time = new Date(data.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const who =
      data.nickname === myNickname
        ? `${YELLOW}${data.nickname}${RESET}`
        : `${BRIGHT_GREEN}${data.nickname}${RESET}`;
    printAbovePrompt(`${DIM}${time}${RESET} ${who}: ${data.text}`);
  });

  socket.on('disconnect', () => {
    if (quitting) return;
    printAbovePrompt(`${RED}connection lost. reconnecting...${RESET}`);
  });

  rl.on('line', (line) => {
    const value = line.trim();
    if (!value) {
      rl.prompt();
      return;
    }

    if (value.startsWith('/')) {
      const [cmd] = value.slice(1).split(' ');
      if (cmd === 'quit' || cmd === 'exit') {
        quitting = true;
        socket.close();
        rl.close();
        return;
      } else if (cmd === 'help') {
        console.log('commands: /help /clear /users /whoami /quit');
      } else if (cmd === 'clear') {
        console.clear();
      } else if (cmd === 'users') {
        console.log(currentUsers.join(', ') || 'nobody here');
      } else if (cmd === 'whoami') {
        console.log(myNickname);
      } else {
        console.log(`${RED}unknown command: ${cmd}${RESET}`);
      }
      rl.prompt();
      return;
    }

    socket.emit('chat:message', value);
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`${GREEN}connection terminated. stay safe.${RESET}`);
    process.exit(0);
  });
}

main();
