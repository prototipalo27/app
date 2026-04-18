This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Gmail OAuth Setup (proyecto Google Cloud: theapp-487115)

El envío de emails usa OAuth 2.0 con Gmail API. Cada usuario conecta su propia cuenta de Google para enviar emails desde su remitente real.

### 1. Credenciales OAuth 2.0

En [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=theapp-487115):

1. **APIs y Servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**
2. Tipo de aplicación: **Aplicación web**
3. Nombre: `Prototipalo App`
4. URI de redirección autorizados:
   - Producción: `https://app.prototipalo.es/api/auth/google/callback`
   - Local: `http://localhost:3000/api/auth/google/callback`
5. Copiar **Client ID** y **Client Secret**

### 2. Pantalla de consentimiento

En **APIs y Servicios → Pantalla de consentimiento de OAuth**:

- Tipo de usuario: **Interno** (solo cuentas @prototipalo.com, sin verificación)
- Nombre de app: `Prototipalo`
- Email de soporte: `manu@prototipalo.com`
- Scopes: `https://www.googleapis.com/auth/gmail.send`
  (en Fase 1 se añadirá `gmail.readonly` incrementalmente)

### 3. Habilitar Gmail API

En **APIs y Servicios → Biblioteca**, buscar **Gmail API** y habilitarla (ya debería estar habilitada por el push de info@).

### 4. Variables de entorno

Añadir a `.env.local` y a Vercel:

```bash
GOOGLE_OAUTH_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_OAUTH_REDIRECT_URI=https://app.prototipalo.es/api/auth/google/callback
```

Para desarrollo local, usar `http://localhost:3000/api/auth/google/callback` como redirect URI.

### Notas

- El service account existente (`theapp@theapp-487115.iam.gserviceaccount.com`) sigue sirviendo para el push de `info@prototipalo.com` y Google Drive. No tocar.
- `include_granted_scopes=true` permite ampliar scopes en fases futuras sin forzar re-login.
- Los tokens OAuth se guardan cifrados (AES-256-GCM) en la tabla `google_accounts`.
