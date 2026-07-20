# rootchat

A real-time, movie-hacker themed terminal chatroom. Matrix rain background, a fake "bypassing the firewall" boot sequence, green-on-black terminal UI — and a fully working group chat underneath, built on Node.js + Socket.IO.

No accounts, no database. Pick a handle, pick (or generate) a channel code, share the code with friends, and you're all in the same room.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
git clone https://github.com/mohammedinzi/rootchat.git
cd rootchat
npm install
npm start
```

Open **http://localhost:4004**. This is local-only: it works on *your* computer, not a friend's.

## Chat straight from your terminal (no browser)

rootchat also ships a terminal client that talks to the same server over the same protocol — same boot sequence and green-on-black look, but it never opens a browser.

```bash
npm run chat
```

It'll prompt you for a handle and a channel code, then drop you straight into the chat prompt. To skip the prompts or connect to a friend's deployed server instead of localhost:

```bash
node bin/rootchat.js --nick neo --room zion-9f2a --server https://your-app.onrender.com
```

In-chat commands: `/help`, `/clear`, `/users`, `/whoami`, `/quit`.

Want a global `rootchat` command instead of `npm run chat`? Run `npm link` once inside this repo — then `rootchat` works from any directory.

## Chatting with friends

rootchat has no built-in accounts — a "channel code" is the only thing that determines who's in the same room. Anyone who connects with the same code lands in the same chat.

### Option A — share a public link (recommended for anything longer than a quick call)

Deploy it once (see below) to get a permanent `https://` URL, then just send friends:

```
https://your-app.onrender.com   channel code: zion-9f2a
```

They open the link, type a handle, type the same channel code, hit connect. Click **SHARE** in the chat header to copy that invite text automatically.

### Option B — run it on your own machine + share a temporary public link

Good for a quick session without deploying anywhere.

```bash
brew install cloudflared  # only needed once on macOS
npm run share
```

It prints a public `https://...trycloudflare.com` URL. Send **that exact URL** plus a channel code to friends. They should open the URL in their browser (or point the terminal client at it with `--server`); they must not run `npm start` themselves, because that makes a separate server and separate chat.

Keep the terminal running and keep your computer awake. The URL stops working when you press `Ctrl+C`, close the terminal, or your machine sleeps. For a permanent link, deploy the app once as described below.

## Deploying so the link is permanent

Any Node host works since this is a plain Express + Socket.IO app. Three easy free-tier options:

**Render** — connect your GitHub repo, Render auto-detects `render.yaml` in this repo. Click deploy. Done.

**Railway** — `railway up` (or connect the repo in their dashboard). No config file needed, it auto-detects Node.

**Fly.io** —
```bash
fly launch --no-deploy   # detects fly.toml already in this repo
fly deploy
```

**Docker** (any VPS/host that runs containers):
```bash
docker build -t rootchat .
docker run -p 4004:4004 rootchat
```

All of them just need the `PORT` env var respected, which the server already does (`process.env.PORT`).

## Commands inside the chat

- `/help` — list commands
- `/clear` — clear your local screen (does not affect other users)
- `/users` — list who's currently in the room
- `/whoami` — print your handle

## How it works

- `server/index.js` — Express serves the static frontend; Socket.IO manages rooms (`socket.join(roomCode)`), broadcasts messages, and tracks who's online per room. All state is in-memory — restarting the server clears all rooms.
- `public/` — plain HTML/CSS/JS, no build step. `matrix.js` draws the falling-code background on a `<canvas>`; `client.js` handles the boot animation, join flow, and chat rendering (all user text is rendered via `textContent`, never `innerHTML`, so messages can't inject HTML/scripts).
- `bin/rootchat.js` — the terminal client. Same Socket.IO protocol as the browser, rendered with ANSI codes via Node's built-in `readline` instead of the DOM.
- Messages are capped at 500 characters and rate-limited per connection (15 messages / 5 seconds) server-side.

## Fork it / make it yours

Because there's no database and no auth, standing up your own instance is just "clone, install, run" (or deploy). Swap the ASCII banner in `public/index.html`, recolor `public/style.css`, or add persistence/auth if you want history across restarts — it's intentionally minimal so it's easy to hack on.

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship your own.
