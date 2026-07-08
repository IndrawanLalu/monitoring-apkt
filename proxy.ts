import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";

  // Rute publik (tanpa auth). Dicek DULUAN agar tidak memanggil
  // supabase.auth.getUser() — 1 round-trip jaringan (~250ms) per request —
  // untuk halaman yang memang tidak butuh sesi (antrian pelanggan, rekap, magic).
  const isPublicRoute =
    pathname.startsWith("/magic") ||
    pathname.startsWith("/antrian") ||
    pathname.startsWith("/rekap-laporan") ||
    pathname.startsWith("/rekap-survey");

  // Domain publik commandcenter.my.id: hanya rute publik, sisanya 404.
  // Tidak perlu validasi auth sama sekali di domain ini.
  if (hostname === "commandcenter.my.id") {
    if (isPublicRoute) return NextResponse.next({ request });
    return new NextResponse(null, { status: 404 });
  }

  // Domain internal: rute publik lolos tanpa validasi auth.
  if (isPublicRoute) return NextResponse.next({ request });

  // --- Mulai sini butuh sesi: baru buat client + validasi user ---
  let supabaseResponse = NextResponse.next({ request });

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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth routes redirect to dashboard if already logged in
  if (pathname.startsWith("/login")) {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // All other routes require auth
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  // Skip middleware untuk static assets (_next, api, dan file dengan ekstensi seperti .png .ico .js .css)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\..+).*)"],
};
