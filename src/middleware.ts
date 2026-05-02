import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveEffectiveProfile } from "@/lib/auth/resolve-profile";

const ALLOWED_DOMAIN = "prototipalo.com";
const IMPERSONATE_COOKIE = "x-impersonate-user-id";
const PROFILE_HEADERS = [
  "x-user-id",
  "x-user-email",
  "x-user-role",
  "x-user-active",
] as const;

export async function middleware(request: NextRequest) {
  // Sanitizamos x-user-* entrantes en TODOS los caminos para impedir que un
  // cliente las inyecte y simule un perfil. Strip al inicio sobre una copia
  // de los headers; los redirects (3xx) no reenvían cabeceras de request al
  // server, así que basta con aplicarlo en los caminos que SÍ forwardean.
  const requestHeaders = new Headers(request.headers);
  for (const h of PROFILE_HEADERS) requestHeaders.delete(h);

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/track/") ||
    pathname.startsWith("/quote/") ||
    pathname.startsWith("/proforma/") ||
    pathname.startsWith("/nda/") ||
    pathname.startsWith("/sample/") ||
    pathname.startsWith("/studio-portal/") ||
    pathname.startsWith("/investors/") ||
    pathname.startsWith("/scan") ||
    pathname === "/offline";

  // Skip Supabase auth check entirely for public routes
  if (isPublic && pathname !== "/login") {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated + protected route -> redirect to login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Safety net: authenticated user with non-allowed domain -> sign out
  if (user && !isPublic && !user.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", `Solo cuentas @${ALLOWED_DOMAIN} pueden acceder`);
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Authenticated + login page -> redirect to dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Pre-cargar perfil y reenviarlo como headers para ahorrar 1 RTT en el page.
  //
  // Esta query corre EN CADA REQUEST a ruta protegida a propósito: queremos
  // que cualquier cambio de role o is_active en user_profiles se refleje
  // instantáneamente al siguiente click. NO cachear esto sin entender que un
  // usuario desactivado/cambiado de rol seguiría viendo páginas con el perfil
  // viejo hasta que expirase la cache.
  if (user && !isPublic) {
    const impersonateId =
      request.cookies.get(IMPERSONATE_COOKIE)?.value ?? null;
    const effectiveProfile = await resolveEffectiveProfile(
      supabase,
      user.id,
      impersonateId
    );

    if (!effectiveProfile) {
      // Auth válida pero sin fila en user_profiles → estado inconsistente.
      // No bloqueamos: el page caerá al fallback de getUserProfile, devolverá
      // null y disparará redirect("/login") en cada page guardada.
      console.warn(
        "[middleware] Authenticated user without user_profiles row",
        { userId: user.id, email: user.email }
      );
    } else {
      requestHeaders.set("x-user-id", effectiveProfile.id);
      requestHeaders.set("x-user-email", effectiveProfile.email);
      requestHeaders.set("x-user-role", effectiveProfile.role);
      requestHeaders.set(
        "x-user-active",
        effectiveProfile.is_active ? "1" : "0"
      );
      const headerResponse = NextResponse.next({
        request: { headers: requestHeaders },
      });
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        headerResponse.cookies.set(cookie.name, cookie.value);
      });
      return headerResponse;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
