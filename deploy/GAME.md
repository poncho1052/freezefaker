# Hosted Deploy

The game is deployed to Higgsfield game hosting (static client + custom
realtime server for online rooms).

- **Play URL:** https://silent-maple-107.higgsfield.gg/
- **game_id:** `1eaea8ea-23b3-4d92-b76b-907f765c5c65`
- **mode:** custom-server (Durable Object bundle from `tools/build-deploy.mjs`)

## Updating the live game

1. Rebuild the bundle and zip it:

   ```bash
   node tools/build-deploy.mjs
   cd dist/deploy && zip -qr ../freezefaker.zip . && cd ../..
   cp dist/freezefaker.zip deploy/freezefaker.zip
   ```

2. Commit + push so the zip is reachable at the raw GitHub URL.
3. Re-run `deploy_game` **passing back the `game_id` above** (omit it and a
   second, separate game URL is created).

Store card assets live in this folder: `thumbnail.png` (16:9 key visual),
`icon.png` (1:1 brand icon).
