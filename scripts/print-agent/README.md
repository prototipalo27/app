# Print Agent

Agente local que corre en el PC al que está conectada la impresora térmica
Munbyn. Se suscribe a la cola `label_print_jobs` de Supabase vía Realtime y manda
cada PDF al spooler del sistema.

## Instalación (Windows)

### 1. Pre-requisitos en el PC

1. **Node.js 20+** — descargar de https://nodejs.org/.
2. **SumatraPDF** — descargar de https://www.sumatrapdfreader.org/. Por
   defecto se instala en `C:\Program Files\SumatraPDF\SumatraPDF.exe`. Si lo
   pones en otra ruta, ajusta `SUMATRA_PATH` en `.env`.
3. **Driver de la Munbyn** instalado y la impresora visible en
   `Panel de Control → Dispositivos e impresoras`. Apunta el nombre exacto.

### 2. Copiar y configurar

```cmd
:: Copia la carpeta scripts\print-agent a, por ejemplo, C:\prototipalo-print-agent
cd C:\prototipalo-print-agent
copy .env.example .env
:: edita .env con notepad y rellena SUPABASE_SERVICE_ROLE_KEY y PRINTER_NAME
npm install
```

La `SERVICE_ROLE_KEY` está en el dashboard de Supabase →
Project Settings → API → `service_role` key. **No la subas al repo.**

### 3. Probar a mano

```cmd
node --env-file=.env index.mjs
```

Deberías ver `Print agent ready — platform: windows, printer: "Munbyn"`.
Inserta un job de prueba desde `/dashboard/admin/print-test` en la app.

### 4. Auto-arranque con NSSM (Windows Service)

```cmd
:: Descargar nssm de https://nssm.cc/ y poner nssm.exe en C:\nssm\
C:\nssm\nssm.exe install PrototipaloPrintAgent
```

Se abre una GUI. Rellenar:

- **Path**: `C:\Program Files\nodejs\node.exe`
- **Startup directory**: `C:\prototipalo-print-agent`
- **Arguments**: `--env-file=.env index.mjs`
- **Details → Display name**: `Prototipalo Print Agent`

Pestaña **I/O**:

- **Output (stdout)**: `C:\prototipalo-print-agent\agent.log`
- **Error (stderr)**: `C:\prototipalo-print-agent\agent.err.log`

Click **Install service**. Luego:

```cmd
C:\nssm\nssm.exe start PrototipaloPrintAgent
```

El servicio se reinicia automáticamente al arrancar Windows y se recupera de
caídas de red.

## Variables de entorno

| Variable                   | Default                                              |
| -------------------------- | ---------------------------------------------------- |
| `SUPABASE_URL`             | (requerida)                                          |
| `SUPABASE_SERVICE_ROLE_KEY`| (requerida — sí, service role; necesita UPDATE)      |
| `PRINTER_NAME`             | `Munbyn`                                             |
| `SUMATRA_PATH`             | `C:\Program Files\SumatraPDF\SumatraPDF.exe`         |

## Linux / macOS

El agente detecta el SO con `os.platform()` y usa `lp -d <printer>` (CUPS) en
lugar de SumatraPDF. Los pasos son los mismos quitando SumatraPDF/NSSM y
usando `systemd` o `launchd` para el auto-arranque.

## Cómo funciona

1. Al arrancar, drenea cualquier job con `status='pending'` (por si el agente
   estaba caído cuando se insertaron).
2. Se suscribe a `INSERT` en `label_print_jobs` vía Realtime.
3. Para cada job: `status='printing'` → descarga PDF → manda al spooler →
   `status='printed'` (o `error` + `error_message`).
