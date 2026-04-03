/**
 * Shared spam/marketing email filter.
 * Used by both the n8n webhook (email-received) and the Gmail push handler.
 */

const SKIP_DOMAINS = [
  "prototipalo.com",
  "webflow.com",
  "support.webflow.com",
];

const SPAM_LOCAL_PARTS = [
  "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
  "newsletter", "newsletters", "news", "mailer", "mailer-daemon",
  "notifications", "notification", "alert", "alerts",
  "marketing", "promo", "promotions", "updates",
  "bounce", "postmaster", "daemon", "info", "comunicacion",
  "comunicaciones", "digest", "suscripciones", "subscriptions",
  "support", "soporte", "billing", "facturacion", "invoice",
  "receipts", "receipt", "account", "accounts", "team",
  "hello", "hola", "contacto", "contact", "ventas", "sales",
  "automailer", "auto", "system", "sistema", "admin",
  "security", "seguridad", "verify", "confirm", "welcome",
  "bienvenido", "feedback", "survey", "encuesta",
  "orden", "order", "orders", "pedido", "pedidos",
  "envio", "envios", "shipping", "delivery", "tracking",
  "clientes", "cliente", "renovaciones", "renewal", "renewals",
  "store", "shop", "tienda", "compras",
];

const MARKETING_SUBDOMAIN_PREFIXES = [
  "message.", "messages.", "mail.", "email.", "e-mail.",
  "news.", "newsletter.", "marketing.", "promo.", "campaign.",
  "campaigns.", "bulk.", "send.", "sender.", "mailing.",
  "notify.", "notification.", "bounce.", "track.", "click.",
  "links.", "go.", "t.", "em.", "em-", "post.",
  "updates.", "alerts.", "info.", "service.", "noreply.",
  "auto.", "system.", "mailer.", "transactional.",
];

const SPAM_DOMAINS = [
  // Mass email platforms
  "mailchimp.com", "mandrillapp.com", "sendgrid.net", "sendgrid.com",
  "sendinblue.com", "brevo.com", "mailgun.org", "mailgun.com",
  "constantcontact.com", "hubspot.com", "hubspotmail.com",
  "amazonses.com", "mailjet.com", "campaignmonitor.com",
  "getresponse.com", "activecampaign.com", "convertkit.com",
  "klaviyo.com", "drip.com", "mailerlite.com", "benchmark.email",
  "exacttarget.com", "salesforce.com", "pardot.com",
  "createsend.com", "cmail19.com", "cmail20.com",
  "outreach.io", "salesloft.com",
  // Google / workspace
  "google.com", "googlemail.com", "google.es",
  "accounts.google.com", "calendar-notification.google.com",
  // Social media
  "linkedin.com", "linkedinmail.com",
  "facebookmail.com", "facebook.com", "meta.com",
  "twitter.com", "x.com",
  "instagram.com",
  "tiktok.com",
  "pinterest.com",
  // Microsoft
  "microsoft.com", "microsoftonline.com", "office365.com",
  "office.com", "outlook.com", "teams.microsoft.com",
  // Apple
  "apple.com", "icloud.com",
  // Dev / SaaS
  "github.com", "gitlab.com", "bitbucket.org", "atlassian.com",
  "jira.com", "confluence.com",
  "notion.so", "slack.com", "slackbot.com",
  "figma.com", "canva.com",
  "vercel.com", "netlify.com", "heroku.com", "render.com",
  "supabase.io", "supabase.com",
  "stripe.com", "paypal.com", "paypal.es",
  "intercom.io", "intercom.com", "zendesk.com", "freshdesk.com",
  "airtable.com", "monday.com", "asana.com",
  "trello.com", "clickup.com",
  "zoom.us", "zoom.com",
  "calendly.com",
  "typeform.com",
  "docusign.com", "docusign.net",
  "dropbox.com", "box.com",
  // Software / tools
  "adobe.com", "creativecloud.com",
  "autodesk.com", "solidworks.com",
  "ngrok.com", "ngrok.io",
  "mouser.com", "mouser.es", "digikey.com", "farnell.com", "rs-online.com",
  // Ferias / eventos
  "easyfairs.com", "firabarcelona.com", "ifema.es",
  // Banks / finance
  "bbva.com", "bbva.es", "santander.com", "santander.es",
  "caixabank.com", "caixabank.es", "bankinter.com",
  "ing.es", "ing.com", "openbank.es",
  "wise.com", "revolut.com", "n26.com",
  // Shipping / logistics
  "dhl.com", "fedex.com", "ups.com", "usps.com",
  "correos.es", "correos.com",
  "seur.com", "seur.es", "mrw.es", "nacex.es", "gls-spain.es",
  "grupomrw.com", "mrw.com",
  "amazon.com", "amazon.es",
  // Hosting / registrars
  "godaddy.com", "namecheap.com", "ovh.com", "ovh.es",
  "ionos.com", "ionos.es", "arsys.es", "dinahosting.com",
  "cloudflare.com",
  "wix.com", "squarespace.com", "shopify.com",
  "mailrelay.com", "acumbamail.com", "mdirector.com",
  // Government / legal
  "agenciatributaria.es", "seg-social.es", "hacienda.gob.es",
  "boe.es",
  // Misc services
  "uber.com", "cabify.com", "glovo.com",
  "spotify.com", "netflix.com",
  "holded.com",
];

const SPAM_SUBJECT_KEYWORDS = [
  // Unsubscribe / newsletters
  "unsubscribe", "darse de baja", "anular suscripci",
  "webinar", "newsletter", "invitación webinar",
  "has been added to", "te has suscrito",
  // Notifications
  "notificación de", "notification from", "alerta de",
  "recordatorio:", "reminder:",
  "your receipt", "tu recibo", "your invoice", "tu factura",
  "payment received", "pago recibido",
  "password reset", "restablecer contraseña", "cambiar contraseña",
  "verify your email", "verifica tu email", "confirma tu email",
  "confirm your account", "confirma tu cuenta",
  "welcome to", "bienvenido a",
  "your order", "tu pedido", "tu envío", "your shipment",
  "out of office", "fuera de la oficina", "autoreply", "auto-reply",
  "respuesta automática",
  // Marketing
  "oferta especial", "special offer", "descuento exclusivo",
  "última oportunidad", "last chance", "act now",
  "free trial", "prueba gratis", "prueba gratuita",
  "black friday", "cyber monday",
  // Security alerts
  "suspicious sign-in", "inicio de sesión sospechoso",
  "new sign-in", "nuevo inicio de sesión",
  "security alert", "alerta de seguridad",
  // Invoices / renewals / subscriptions
  "factura ", "invoice ", "your bill", "tu factura",
  "renovación", "renewal", "su suscripción", "your subscription",
  "dominio", "domain expir", "ssl certificat",
  "payment method", "método de pago", "actualiza tu método",
  // Events / fairs / webinars
  "salon ", "feria ", "expo ", "exposición",
  "visitantes cualificados", "stand ", "reserve su",
  "join us", "register now", "inscríbete",
  // Out of office (more variants)
  "absence du bureau", "fuera de oficina", "estoy de vacaciones",
  "i am currently out", "estaré fuera",
  // Newsletters / content
  "[news]", "[newsletter]", "[digest]",
  "esta semana en", "this week in", "weekly update", "monthly update",
  "novedades de", "lo nuevo de",
];

const SPAM_BODY_INDICATORS = [
  "unsubscribe", "darse de baja", "click here to unsubscribe",
  "email preferences", "preferencias de email",
  "manage your subscription", "gestionar suscripción",
  "you are receiving this email because",
  "recibes este email porque", "recibes este correo porque",
  "this is an automated message", "este es un mensaje automático",
  "do not reply to this email", "no respondas a este correo",
  "list-unsubscribe",
  "view in browser", "ver en el navegador", "ver en navegador",
  "privacy policy", "política de privacidad",
  "terms of service", "términos de servicio",
  "update your preferences", "actualizar preferencias",
  "powered by mailchimp", "powered by hubspot", "powered by sendgrid",
  "sent by", "enviado por", "enviado desde",
  "you signed up for", "te suscribiste",
  "all rights reserved", "todos los derechos reservados",
  "añadir a contactos", "add to contacts",
];

export type SpamCheckResult =
  | { spam: false }
  | { spam: true; reason: string };

/**
 * Check if an email should be filtered as spam/marketing.
 */
export function checkSpam(email: {
  from: string;
  subject: string;
  body: string;
  reply_to?: string;
}): SpamCheckResult {
  const fromDomain = email.from.split("@")[1] || "";
  const fromLocal = email.from.split("@")[0] || "";
  const subjectLower = email.subject.toLowerCase();
  const bodyLower = email.body.toLowerCase();

  // Internal domains
  if (SKIP_DOMAINS.some((d) => fromDomain === d || fromDomain.endsWith("." + d))) {
    return { spam: true, reason: "internal_or_notification_sender" };
  }

  // Auto-generated local parts (e.g. clientes.02649@)
  if (/^[a-z]+[._]\d{3,}$/.test(fromLocal)) {
    return { spam: true, reason: "auto_generated_sender" };
  }

  // Known automated local parts
  if (SPAM_LOCAL_PARTS.some((p) => fromLocal === p || fromLocal.startsWith(p + "+"))) {
    return { spam: true, reason: "automated_sender" };
  }

  // Marketing subdomains
  if (MARKETING_SUBDOMAIN_PREFIXES.some((p) => fromDomain.startsWith(p))) {
    return { spam: true, reason: "marketing_subdomain" };
  }

  // Known spam/service domains
  if (SPAM_DOMAINS.some((d) => fromDomain === d || fromDomain.endsWith("." + d))) {
    return { spam: true, reason: "mass_email_platform" };
  }

  // Subject keywords
  if (SPAM_SUBJECT_KEYWORDS.some((kw) => subjectLower.includes(kw))) {
    return { spam: true, reason: "spam_subject_keyword" };
  }

  // Bulk reply-to hash
  const replyTo = (email.reply_to || "").toLowerCase();
  if (/^reply-[a-z0-9]{16,}@/.test(replyTo)) {
    return { spam: true, reason: "bulk_reply_to_hash" };
  }

  // Body spam indicators (1+ match is enough)
  const bodyHits = SPAM_BODY_INDICATORS.filter((ind) => bodyLower.includes(ind)).length;
  if (bodyHits >= 1) {
    return { spam: true, reason: "spam_body_indicators" };
  }

  return { spam: false };
}
