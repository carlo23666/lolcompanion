# Install LoL Companion (beta for friends)

LoL Companion is a desktop app that watches YOUR live game and history and suggests item
buys and picks, with explanations. Everything stays on your PC: no server, no accounts,
nothing is shared.

**Riot-compliant**: it only uses screen-visible information and your own history. It doesn't
track enemy cooldowns or read memory. It shouldn't pose any risk to your account, but it's a
personal project with no warranties.

## 1. Install

1. Run `LoL Companion-<version>-setup.exe`.
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

## 3. Get your Riot API key (free, one time)

The app needs a Riot key to read your match history. The key is personal: everyone registers
their own (Riot's rules forbid sharing keys or embedding them in the app), but you do it once
and it doesn't expire daily.

1. Go to <https://developer.riotgames.com> and sign in with your Riot account.
2. Top right: your profile → **Apps** → **Register App** ("Personal App" portal).
3. Fill in the basics: a name (e.g. "LoL Companion personal"), a short description ("local
   desktop companion for my own games, read-only") and choose **Personal App**.
4. Riot approves it (usually within hours, sometimes instantly) and gives you a **persistent**
   key starting with `RGAPI-`.
5. In LoL Companion: **Settings → Account → Riot API key** → paste it.

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
- **In game**: explained buy recommendations, enemy power-spike alerts and objective windows.
  There's an optional overlay in Settings (needs LoL windowed or borderless; it doesn't work in
  exclusive fullscreen).
- **After**: a game report vs your own averages, history and stats.

## Known issues

- "Account not found" → check the Riot ID (exact name#TAG) and the region.
- Sync fails after working yesterday → your key was the development one (24 h) and it expired;
  register the Personal App in step 3 and it won't happen again.
- The overlay doesn't show → LoL is in exclusive fullscreen; switch it to "borderless".
- Anything else → screenshot it and send it to Carlo.
