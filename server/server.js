// Freeze Faker local/self-hosted multiplayer server (Node 18+, zero deps).
// Serves the game statically and runs the shared match core over WebSockets.
// The hosted deploy uses the same core via tools/build-deploy.mjs.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from './wsserver.js';
import { makePlayer, handleMessage } from './match.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8090;

const server = createServer({
  root: ROOT,
  onConnection(conn) {
    const player = makePlayer(conn);
    conn.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      handleMessage(player, m);
    });
    conn.on('close', () => { if (player.room) player.room.remove(player.id); });
  },
});

server.listen(PORT, () => {
  console.log(`\n  Freeze Faker server running:  http://localhost:${PORT}\n  (open in your browser; share the room code with friends)\n`);
});
