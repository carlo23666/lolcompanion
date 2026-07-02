# certs/

`riotgames.pem` — Riot Games root certificate used to pin the self-signed TLS
cert of the Live Client Data API (`https://127.0.0.1:2999`).

Download it from the official Riot developer docs
(https://developer.riotgames.com/docs/lol#game-client-api) and place it here as
`riotgames.pem`. It is bundled with the app; TLS verification is never disabled
globally (see CLAUDE.md hard rules).

Added in WP-001.
