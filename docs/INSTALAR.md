# Instalar LoL Companion (beta para amigos)

LoL Companion es una app de escritorio que mira TU partida en directo y tu historial, y te
sugiere compras de objetos y picks con explicaciones. Todo se queda en tu PC: no hay servidor,
no hay cuentas, no se comparte nada.

**Cumple las normas de Riot**: solo usa información visible en pantalla y tu propio historial.
No trackea cooldowns enemigos ni lee memoria. No debería suponer ningún riesgo para tu cuenta,
pero es un proyecto personal sin garantías.

## 1. Instalar

1. Ejecuta `LoL Companion-<versión>-setup.exe`.
2. Windows SmartScreen avisará ("aplicación no reconocida") porque la app no está firmada:
   pulsa **Más información → Ejecutar de todas formas**.
3. Se instala solo para tu usuario (no pide administrador) y se abre al terminar.

A partir de la 1.4.0 **la app se actualiza sola**: detecta cada nueva versión, la descarga en
segundo plano y te pregunta si reiniciar (si dices "luego", se aplica al cerrar). Solo instalas
a mano esta primera vez. Tus ajustes, clave e historial se conservan siempre entre versiones.

## 2. Conseguir tu clave de la API de Riot (gratis, una sola vez)

La app necesita una clave de Riot para leer tu historial de partidas. La clave es personal:
cada uno registra la suya (las normas de Riot prohíben compartir claves o meterlas dentro de
la app), pero se hace UNA vez y no caduca a diario.

1. Entra en <https://developer.riotgames.com> con tu cuenta de Riot.
2. Arriba a la derecha: tu perfil → **Apps** → **Register App** (portal "Personal App").
3. Rellena lo mínimo: nombre (p. ej. "LoL Companion personal"), descripción corta ("companion
   local de escritorio para mis propias partidas, solo lectura") y elige **Personal App**.
4. Riot la aprueba (normalmente en horas, a veces al momento) y te da una clave **persistente**
   que empieza por `RGAPI-`.
5. En LoL Companion: **Ajustes → Cuenta → Clave de la API de Riot** → pégala.

Mientras esperas la aprobación puedes usar la **Development API Key** de la página principal
del portal — funciona igual pero ⚠️ caduca cada 24 horas (vuelve a la web, *Regenerate API
Key*, pega la nueva). Con la Personal App te olvidas de esto.

Nota: una clave recién generada tarda unos minutos en activarse; si da error nada más pegarla,
espera 2-3 minutos.

## 3. Configurar tu cuenta

En **Ajustes → Cuenta**:

1. **Riot ID**: tu nombre completo con tag, por ejemplo `TuNombre#EUW`.
2. **Región**: `euw1` para EUW.
3. Pulsa **Guardar** y después **Sincronizar historial** (descarga tus últimas 200 partidas,
   tarda unos minutos la primera vez).

## 4. Usarla

- Deja la app abierta (segundo monitor va perfecto). Detecta sola el cliente de LoL, el champ
  select y la partida — no hay que hacer nada.
- **Champ select**: análisis de composiciones y sugerencias de pick según tu historial y datos
  de Master+.
- **En partida**: recomendaciones de compra explicadas, alertas de power-spikes enemigos y
  ventanas de objetivos. Hay un overlay opcional en Ajustes (requiere LoL en ventana o sin
  bordes, no funciona en pantalla completa exclusiva).
- **Después**: informe de la partida vs tus propias medias, historial y estadísticas.

## Problemas conocidos

- "Cuenta no encontrada" → revisa el Riot ID (nombre#TAG exacto) y la región.
- Sincronización falla tras funcionar ayer → tu clave era la de desarrollo (24h) y ha caducado;
  registra la Personal App del paso 2 y no volverá a pasar.
- El overlay no se ve → LoL está en pantalla completa exclusiva; cámbialo a "sin bordes".
- Cualquier otra cosa → pantallazo y mándaselo a Carlo.
