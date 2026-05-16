import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
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

  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";

  // Aturan khusus untuk domain publik commandcenter.my.id
  if (hostname === "commandcenter.my.id") {
    // Di domain publik, hanya izinkan akses ke rute /antrian.
    if (pathname.startsWith("/antrian") || pathname.startsWith("/rekap-laporan")) {
      return supabaseResponse;
    }
    // Semua path lain di domain publik akan menampilkan 404 Not Found.
    return new NextResponse(null, { status: 404 });
  }

  // Rute publik untuk domain internal (magic link petugas & fallback antrian)
  const isPublicRoute =
    pathname.startsWith("/magic") || pathname.startsWith("/antrian") || pathname.startsWith("/rekap-laporan");
  if (isPublicRoute) {
    return supabaseResponse;
  }

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
