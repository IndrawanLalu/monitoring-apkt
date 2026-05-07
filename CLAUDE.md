# MONITORING APKT — Project Standards

## Overview

Aplikasi monitoring **internal** laporan gangguan pelanggan PLN.
Command Center menginput laporan → notifikasi otomatis ke WhatsApp grup regu → petugas update status via magic link → dashboard real-time terpusat.

Aplikasi ini berjalan **paralel** dengan APKT korporat (tidak ada integrasi langsung).

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 14+ (App Router, TypeScript strict) |
| Database | Supabase (PostgreSQL + Realtime + Auth + RLS) |
| Styling | Tailwind CSS v3 + Neobrutalism |
| WhatsApp | whatsapp-web.js + Socket.io |
| Runtime | Node.js 18+ |

---

## Domain Model

### Status Laporan

| Status | Kode | Deskripsi |
|---|---|---|
| Lapor | `lapor` | Laporan baru masuk, belum ada tindakan |
| Sedang Ditangani | `ditangani` | Petugas aktif di lokasi |
| Nyala Sementara | `nyala_sementara` | Hold/pending — wajib ada keterangan |
| Selesai | `selesai` | Pekerjaan selesai |

> Setiap laporan memiliki satu kolom `keterangan` yang bisa diupdate kapanpun,
> ikut tampil di semua status dan rekap WA.

### Struktur Organisasi

```
Perusahaan (PLN)
└── ULP (multi-tenant, konfigurasi mandiri)
    └── Shift: Pagi / Sore / Malam
        ├── Command Center (operator web app)
        └── Regu 1..6 (1–2 petugas per regu)
            └── Petugas (update via magic link WA)
```

### Alur Laporan

```
1. CC input laporan di app
2. App simpan ke DB → kirim WA otomatis ke grup ULP
   - Pesan berisi: no tiket, pelanggan, lokasi, regu, magic link
3. Petugas baca WA → pergi ke lokasi → klik magic link → update status
   (atau petugas telpon CC → CC update di app)
4. Setiap update status → WA reply ke thread pesan asli
5. Dashboard real-time terupdate via Supabase Realtime
```

---

## Database Schema

```sql
-- Multi-tenant root
ulp (id, nama, kode, wa_grup_id)

-- Organisasi
regu (id, ulp_id, nama)
petugas (id, ulp_id, regu_id, nama, nomor_hp)

-- Shift
shift_type (id, nama, jam_mulai, jam_selesai)   -- Pagi/Sore/Malam
piket (id, ulp_id, shift_type_id, tanggal)

-- Laporan (core)
laporan (
  id, nomor_tiket, ulp_id, piket_id, regu_id,
  nama_pelanggan, nomor_pelanggan, lokasi,
  status,        -- enum: lapor | ditangani | nyala_sementara | selesai
  keterangan,    -- nullable, bisa diupdate kapanpun
  magic_token,   -- UUID unik untuk magic link petugas
  wa_message_id, -- ID pesan WA pertama (untuk reply thread)
  created_at, updated_at, resolved_at
)

-- Audit trail
riwayat_status (id, laporan_id, status_lama, status_baru, keterangan, updated_by, created_at)

-- WhatsApp
wa_session (id, ulp_id, status, session_data, updated_at)

-- Users (Supabase Auth profiles)
profiles (id, ulp_id, nama, role)   -- role: admin | supervisor | cc
```

---

## WhatsApp Integration

### Pesan Laporan Baru
```
🔴 LAPORAN BARU | #G441550xxx
👤 Pelanggan : Ibu Sri | 08123456789
📍 Lokasi    : Jl. Merdeka No. 10
👷 Regu      : Regu 2
🔗 Update    : https://app/wo/<magic_token>
```

### Reply Update Status
```
↩️ #G441550xxx
🟡 Sedang Ditangani
🕐 14:32 | Regu 2
📝 sedang dalam perjalanan
```

### Kirim Laporan per Regu (manual CC)
```
📋 LAPORAN AKTIF — REGU 2
Shift Pagi | 07:00–15:00 | 07 Mei 2026

1. #G441550xxx | Ibu Sri | Jl. Merdeka
   Status: 🟡 Sedang Ditangani

2. #G441550xxx | Pak Budi | Jl. Gatot
   Status: 🔴 Lapor

Total Aktif: 2 laporan
```

### Rekap Serah Terima Piket (manual CC)
```
📊 REKAP SERAH TERIMA — SHIFT PAGI
ULP Bandung Barat | 07 Mei 2026

REGU 1 (Budi & Slamet)
  ✅ Selesai          : 5
  🟡 Nyala Sementara  : 2
       - #G441 | Ibu Sri     : tidak bisa dihubungi
       - #G442 | Pak Ahmad   : belum selesai dikerjakan
  🔴 Belum Ditangani  : 1
       - #G443 | Ibu Rina    : belum sempat dikerjakan
  📌 Total            : 8

─────────────────────
TOTAL ULP
  ✅ Selesai          : 25
  🟡 Nyala Sementara  : 3
  🔴 Belum            : 2
  📌 Grand Total      : 30
```

---

## UI Guidelines

### Design System: Neobrutalism + PLN

**PLN Color Palette:**
```
--pln-blue       : #003B8E   (primary)
--pln-blue-mid   : #0070C0   (secondary)
--pln-yellow     : #FFD200   (accent)
--pln-red        : #E4002B   (danger / belum)
--pln-orange     : #F5A623   (nyala sementara)
--pln-green      : #1DB954   (selesai)
--neo-black      : #1A1A1A   (border, text)
--neo-white      : #FAFAFA   (background)
--neo-gray       : #E5E5E5   (surface)
```

**Neobrutalism Rules:**
- Border: `2px solid #1A1A1A` (semua card, button, input)
- Shadow: `4px 4px 0px #1A1A1A` (card), `2px 2px 0px #1A1A1A` (button)
- Hover button: `translate(-2px, -2px)` + shadow `6px 6px 0px #1A1A1A`
- Radius: `0px` (default), max `4px` untuk badge kecil
- Font: `font-bold` untuk heading, `font-medium` untuk body

### Status Badge Colors
```
lapor           → bg: #E4002B  text: white
ditangani       → bg: #0070C0  text: white
nyala_sementara → bg: #FFD200  text: #1A1A1A
selesai         → bg: #1DB954  text: white
```

---

## Code Standards

### TypeScript
- `strict: true` — tidak ada `any`, tidak ada `as unknown`
- Semua enum menggunakan `const` object dengan `as const`
- Tipe didefinisikan di `types/` dan di-export dari `types/index.ts`
- Tidak ada unused import atau unused variable

### React / Next.js
- Server Components by default; gunakan `'use client'` hanya bila perlu
- Data fetching di Server Component, bukan `useEffect`
- Loading/error state wajib di setiap page (`loading.tsx`, `error.tsx`)
- Gunakan `next/image` untuk semua gambar
- Tidak ada hardcoded string UI — gunakan konstanta

### API Routes
- Selalu validasi input dengan `zod`
- Return tipe konsisten: `{ data, error }` atau `{ success, message }`
- HTTP status code harus tepat (200, 201, 400, 401, 403, 404, 500)
- Tidak ada `console.log` di production code

### Supabase
- Selalu gunakan RLS (Row Level Security) — tidak ada bypass
- Query dengan `supabase.from().select()` harus spesifik kolom, bukan `*`
- Error dari Supabase selalu di-handle, tidak diabaikan
- Gunakan Supabase Realtime untuk update dashboard

### Penamaan
- File: `kebab-case.tsx`
- Komponen: `PascalCase`
- Fungsi/variabel: `camelCase`
- Konstanta: `UPPER_SNAKE_CASE`
- Database kolom: `snake_case`

### Struktur File
```
app/
  (auth)/login/
  (dashboard)/
    dashboard/
    laporan/
    regu/
    piket/
    settings/
  api/
    laporan/
    wa/
    magic/[token]/
components/
  ui/          -- Button, Card, Badge, Input, Modal
  laporan/     -- laporan-specific components
  dashboard/   -- dashboard-specific components
  wa/          -- whatsapp components
lib/
  supabase/    -- client, server, admin
  wa/          -- whatsapp-web.js wrapper
  validations/ -- zod schemas
  utils/       -- pure utility functions
types/
  index.ts
constants/
  index.ts
hooks/
```

### Git
- Commit message: `feat:`, `fix:`, `refactor:`, `chore:` prefix
- Tidak ada commit file `.env`, `node_modules`, atau secret apapun

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=
MAGIC_LINK_SECRET=

# WhatsApp (server-side only)
WA_SESSION_DIR=./wa-sessions
```

---

## Feature Checklist

- [ ] Auth (login CC & Supervisor, per ULP)
- [ ] Dashboard full-screen per regu + real-time
- [ ] Input laporan (form CC)
- [ ] Update status laporan (CC di app)
- [ ] Magic link (halaman mobile-friendly untuk petugas)
- [ ] Kirim WA otomatis saat laporan baru
- [ ] Reply WA thread saat status update
- [ ] Tombol kirim laporan per regu (manual CC)
- [ ] Tombol rekap serah terima piket
- [ ] Manajemen ULP, Regu, Petugas (admin)
- [ ] Manajemen Shift & Piket
- [ ] Riwayat status per laporan
- [ ] Multi-ULP isolation (RLS)
