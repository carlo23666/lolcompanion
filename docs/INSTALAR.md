# Instalar WinCon (beta para amigos)

WinCon es una app de escritorio que mira TU partida en directo y tu historial, y te
sugiere compras de objetos y picks con explicaciones. Todo se queda en tu PC: no hay servidor,
no hay cuentas, no se comparte nada.

El proyecto se diseña alrededor de las normas de Riot: solo entradas visibles en pantalla,
nada de cooldowns enemigos, identidades en champ select ranked, memoria ni paquetes. Ninguna
herramienta de terceros puede garantizar el resultado para una cuenta. La integración local
LCU usada para champ select no está soportada oficialmente por Riot y puede cambiar.

## 1. Instalar

1. Ejecuta `WinCon-<versión>-setup.exe`.
2. Windows SmartScreen avisará ("aplicación no reconocida") porque la app no está firmada:
   pulsa **Más información → Ejecutar de todas formas**.
3. Se instala solo para tu usuario (no pide administrador) y se abre al terminar.

A partir de la 1.4.0 **la app se actualiza sola**: detecta cada nueva versión, la descarga en
segundo plano y te pregunta si reiniciar (si dices "luego", se aplica al cerrar). Solo instalas
a mano esta primera vez. Tus ajustes, clave e historial se conservan siempre entre versiones.

## 2. Elegir idioma

La app está disponible en **inglés y español**. Una instalación nueva empieza en inglés; puedes
cambiarlo cuando quieras en **Ajustes → Idioma**. Las recomendaciones, avisos y el coach local
opcional usan el idioma elegido.

## 3. Configurar el historial (solo instalaciones privadas/de desarrollo)

El espacio local en directo no necesita clave. Para leer el historial se consulta la API web
de Riot. Los pasos siguientes solo son adecuados para las instalaciones privadas de pruebas
del propietario. Las claves personales o de desarrollo no sirven como credencial de una app
pública; para eso hace falta registrar el producto y obtener una clave de producción.

1. Entra en <https://developer.riotgames.com> con tu cuenta de Riot.
2. Arriba a la derecha: tu perfil → **Apps** → **Register App** (portal "Personal App").
3. Rellena lo mínimo: nombre (p. ej. "WinCon personal"), descripción corta ("companion
   local de escritorio para mis propias partidas, solo lectura") y elige **Personal App**.
4. Riot la aprueba (normalmente en horas, a veces al momento) y te da una clave **persistente**
   que empieza por `RGAPI-`.
5. En WinCon: **Ajustes → Cuenta → Clave de la API de Riot** → pégala.

Mientras esperas la aprobación puedes usar la **Development API Key** de la página principal
del portal — funciona igual pero ⚠️ caduca cada 24 horas (vuelve a la web, *Regenerate API
Key*, pega la nueva). Con la Personal App te olvidas de esto.

Nota: una clave recién generada tarda unos minutos en activarse; si da error nada más pegarla,
espera 2-3 minutos.

## 4. Configurar tu cuenta

En **Ajustes → Cuenta**:

1. **Riot ID**: tu nombre completo con tag, por ejemplo `TuNombre#EUW`.
2. **Región**: `euw1` para EUW.
3. Pulsa **Guardar** y después **Sincronizar historial** (descarga tus últimas 200 partidas,
   tarda unos minutos la primera vez).

## 5. Usarla

- Deja la app abierta (segundo monitor va perfecto). Detecta sola el cliente de LoL, el champ
  select y la partida — no hay que hacer nada.
- **Champ select**: análisis de composiciones y sugerencias de pick según tu historial y datos
  de Master+.
- **En partida**: recomendaciones de compra explicadas, alertas de power-spikes, ventanas de
  objetivos y avisos prudentes de 1v1 basados solo en ventaja material visible. El overlay opcional
  se puede mover y escalar, y muestra el icono y nombre del objeto al recomendar una compra.
  Requiere LoL en ventana o sin bordes; no funciona de forma fiable en pantalla completa exclusiva.
- **Después**: informe de la partida vs tus propias medias, historial y estadísticas.

## Problemas conocidos

- "Cuenta no encontrada" → revisa el Riot ID (nombre#TAG exacto) y la región.
- Sincronización falla tras funcionar ayer → comprueba si la clave privada de desarrollo (24h)
  ha caducado y regenera la credencial apropiada para tu entorno de pruebas.
- El overlay no se ve → LoL está en pantalla completa exclusiva; cámbialo a "sin bordes".
- Cualquier otra cosa → pantallazo y mándaselo a Carlo.
