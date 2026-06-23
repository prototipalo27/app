import { GtmScript, GtmNoScript } from "./Gtm";

// Layout del segmento /campamento. Carga Google Tag Manager solo en las páginas
// públicas del campamento (landing y /gracias), sin afectar al resto del sitio.
export default function CampamentoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <GtmNoScript />
      <GtmScript />
      {children}
    </>
  );
}
