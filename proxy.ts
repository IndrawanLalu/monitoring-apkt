import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Hostname yang dipakai PELANGGAN. Alamatnya beredar di riwayat WhatsApp mereka.
 *
 * Perbandingannya persis. Kalau suatu saat domain publiknya berganti, nilai di
 * sini WAJIB ikut diganti — kalau tidak, pagar di bawah berhenti berlaku dan
 * seluruh halaman staf terbuka ke publik TANPA peringatan apa pun. Staf memakai
 * hostname lain (dulu `app.commandcenter.my.id`) yang sengaja tidak dipagari.
 */
const HOSTNAME_PELANGGAN = "commandcenter.my.id";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";

  // Satu-satunya rute yang boleh dibuka pelanggan. Dijaga token acak 48
  // karakter di URL-nya, bukan oleh sesi login.
  const isRutePelanggan = pathname.startsWith("/antrian");

  // Rute yang tidak butuh sesi login, tapi hanya lewat hostname staf. Halaman
  // rekap punya gerbang passwordnya sendiri.
  //
  // Dicek DULUAN agar tidak memanggil supabase.auth.getUser() — 1 round-trip
  // jaringan (~250ms) per request — untuk halaman yang memang tidak butuh sesi.
  const isRuteTanpaLogin =
    isRutePelanggan ||
    pathname.startsWith("/rekap-laporan") ||
    pathname.startsWith("/rekap-survey");

  // Hostname pelanggan: HANYA rute antrian, sisanya 404 kosong — bukan halaman
  // login, bukan petunjuk apa pun.
  //
  // Rekap sengaja TIDAK diloloskan di sini meski tak butuh login: halaman itu
  // menampilkan PII pelanggan SELURUH ULP (nama, alamat, nomor tiket, isi saran
  // survey) dan hanya dijaga satu password bersama. Terlalu berharga untuk
  // dipaparkan di hostname yang alamatnya beredar luas.
  if (hostname === HOSTNAME_PELANGGAN) {
    if (isRutePelanggan) return NextResponse.next({ request });
    return new NextResponse(null, { status: 404 });
  }

  // Hostname staf: rute tanpa login lolos tanpa validasi auth.
  if (isRuteTanpaLogin) return NextResponse.next({ request });

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
    // Pemutus loop: kalau /dashboard memulangkan user ke sini dengan ?err=,
    // JANGAN pantulkan balik ke /dashboard — sesi memang valid, tapi profilnya
    // bermasalah, jadi memantulkan hanya menghasilkan redirect tak berujung.
    const adaErr = request.nextUrl.searchParams.has("err");
    if (user && !adaErr) {
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
