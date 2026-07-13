# Install WinCon (beta for friends)

WinCon is a desktop app that watches YOUR live game and history and suggests item
buys and picks, with explanations. Everything stays on your PC: no server, no accounts,
nothing is shared.

The project is designed around Riot's third-party rules: screen-visible live inputs only, no
enemy cooldown tracking, no identity exposure in ranked champ select, and no memory or packet
access. No third-party tool can guarantee account outcomes. The local LCU integration used for
champ select is unsupported by Riot and may change.

## 1. Install

1. Run `WinCon-<version>-setup.exe`.
2. Windows SmartScreen will warn you ("unrecognized app") because the app isn't code-signed:
   click **More info → Run anyway**.
3. It installs for your user only (no admin needed) and opens when it finishes.

From 1.4.0 on **the app updates itself**: it detects each new version, downloads it in the
background and asks whether to restart (if you say "later", it applies on close). You only
install by hand this first time. Your settings, key and history always carry over between
versions.

## 2. Choose your language

The app is available in **English and Spanish**. On first run it defaults to English; switch
any time in **Settings → Language**. Everything the app generates — recommendations, tips and
the optional AI coach — follows your chosen language.

## 3. Configure history sync (private/development installs only)

The live local workspace does not need an API key. Reading match history calls the Riot Web API.
The setup below is only appropriate for the owner's private testing/development installs.
Development and personal keys are not credentials for a publicly distributed consumer app; that
requires Riot product registration and a production key.

1. Go to <https://developer.riotgames.com> and sign in with your Riot account.
2. Top right: your profile → **Apps** → **Register App** ("Personal App" portal).
3. Fill in the basics: a name (e.g. "WinCon personal"), a short description ("local
   desktop companion for my own games, read-only") and choose **Personal App**.
4. Riot approves it (usually within hours, sometimes instantly) and gives you a **persistent**
   key starting with `RGAPI-`.
5. In WinCon: **Settings → Account → Riot API key** → paste it.

While you wait for approval you can use the **Development API Key** from the portal home page —
it works the same but ⚠️ expires every 24 hours (go back to the site, *Regenerate API Key*,
paste the new one). With the Personal App you can forget about this.

Note: a freshly generated key takes a few minutes to activate; if it errors right after you
paste it, wait 2-3 minutes.

## 4. Set up your account

In **Settings → Account**:

1. **Riot ID**: your full name with tag, e.g. `YourName#EUW`.
2. **Region**: `euw1` for EUW.
3. Press **Save** and then **Sync history** (downloads your last 200 games; takes a few minutes
   the first time).

## 5. Use it

- Leave the app open (a second monitor is perfect). It detects the LoL client, champ select and
  the game by itself — nothing to do.
- **Champ select**: composition analysis and pick suggestions from your history and Master+ data.
- **In game**: explained buy recommendations, enemy power-spike alerts, objective windows and
  conservative isolated-fight hints from visible material only. The optional overlay in Settings
  can be moved and scaled, and purchase speech includes the item icon and name. It needs LoL in
  windowed or borderless mode; exclusive fullscreen does not support it reliably.
- **After**: a game report vs your own averages, history and stats.

## Known issues

- "Account not found" → check the Riot ID (exact name#TAG) and the region.
- Sync fails after working yesterday → check whether the private development key (24 h) expired
  and regenerate the credential appropriate for your test environment.
- The overlay doesn't show → LoL is in exclusive fullscreen; switch it to "borderless".
- Anything else → screenshot it and send it to Carlo.
