#!/usr/bin/env node

/**
 * Start a local rootchat server and expose it through a temporary public URL.
 * The URL is intentionally short-lived: close this process to close the room.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const port = Number(process.env.PORT || 4004);
let server;
let tunnel;
let shuttingDown = false;

function stop(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (tunnel && !tunnel.killed) tunnel.kill("SIGTERM");
  if (server && !server.killed) server.kill("SIGTERM");
  process.exit(exitCode);
}

async function main() {
  server = spawn(process.execPath, [path.join(__dirname, "..", "server", "index.js")], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => {
    if (chunk.toString().includes("listening on port")) connectTunnel();
  });
  server.stderr.pipe(process.stderr);
  server.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`\n[rootchat] server stopped unexpectedly (exit ${code ?? "unknown"}).`);
      stop(1);
    }
  });
}

async function connectTunnel() {
  tunnel = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let printedUrl = false;
  const onOutput = (chunk) => {
    const output = chunk.toString();
    const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !printedUrl) {
      printedUrl = true;
      console.clear();
      console.log("\x1b[32mROOTCHAT SHARE MODE\x1b[0m\n");
      console.log("Your chat is live. Send this exact URL to your friends:\n");
      console.log(`  \x1b[1;36m${match[0]}\x1b[0m\n`);
      console.log("Everyone must open this same URL and enter the same channel code.");
      console.log("Keep this terminal open. Press Ctrl+C to take the chat offline.\n");
    }
    if (!printedUrl && /not found|ENOENT/i.test(output)) {
      console.error("\n[rootchat] cloudflared is required for sharing.");
      console.error("Install it once with: brew install cloudflared");
      stop(1);
    }
  };

  tunnel.stdout.on("data", onOutput);
  tunnel.stderr.on("data", onOutput);
  tunnel.on("error", (error) => {
    console.error("\n[rootchat] Could not start cloudflared:", error.message);
    console.error("Install it once with: brew install cloudflared");
    stop(1);
  });
  tunnel.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`\n[rootchat] public tunnel stopped unexpectedly (exit ${code ?? "unknown"}).`);
      stop(1);
    }
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
main();
