import Script from "next/script";

// ID del contenedor de Google Tag Manager (GTM-XXXXXXX). Se lee de la variable
// de entorno para no exponerlo en el código y poder cambiarlo sin desplegar.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

// Script de arranque de GTM. Se inyecta solo en las páginas públicas del
// campamento (ver layout.tsx), nunca en el panel interno.
export function GtmScript() {
  if (!GTM_ID) return null;
  return (
    <Script id="gtm-init" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  );
}

// Fallback para navegadores sin JavaScript.
export function GtmNoScript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
