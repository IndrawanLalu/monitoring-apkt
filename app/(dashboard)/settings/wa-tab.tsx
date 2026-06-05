"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { WA_SESSION_STATUS } from "@/constants";
import type { WaSessionStatus } from "@/types";
import Image from "next/image";

interface WaSession {
  id: string;
  user_id: string;
  status: WaSessionStatus;
  session_data: Record<string, unknown> | null;
  updated_at: string;
}

interface Props {
  userId?: string;
  ulpId: string;
  waGrupId: string;
  onGrupIdChange: (id: string) => void;
  waSession: WaSession | null;
  onSessionChange: (s: WaSession) => void;
  onToast: (text: string, type: "success" | "error" | "info") => void;
}

function statusInfo(status?: WaSessionStatus) {
  switch (status) {
    case WA_SESSION_STATUS.CONNECTED:  return { label: "✅ Terhubung",        bg: "#1DB954", text: "#fff" };
    case WA_SESSION_STATUS.SCANNING:   return { label: "🔄 Menunggu Kode",   bg: "#FFD200", text: "#0F172A" };
    case WA_SESSION_STATUS.LOADING:    return { label: "⏳ Memuat...",        bg: "#0070C0", text: "#fff" };
    default:                           return { label: "⭕ Tidak Terhubung", bg: "var(--bg-surface-3)", text: "var(--text-secondary)" };
  }
}

export function WaTab({ userId, ulpId, waGrupId, onGrupIdChange, waSession, onSessionChange, onToast }: Props) {
  const [initLoading, setInitLoading]       = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [disconnecting, setDisconnecting]   = useState(false);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [phoneNumber, setPhoneNumber]       = useState("");
  const [linkMode, setLinkMode]             = useState<"qr" | "phone">("phone");
  const [loadingGrup, setLoadingGrup]       = useState(false);
  const [grupList, setGrupList]             = useState<{ nama: string; id: string }[]>([]);

  // Polling saat loading/scanning
  useEffect(() => {
    if (waSession?.status !== "loading" && waSession?.status !== "scanning") return;
    const interval = setInterval(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("wa_session")
        .select("id, user_id, status, session_data, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        const d = data as WaSession;
        if (d.status !== waSession?.status || d.updated_at !== waSession?.updated_at) {
          onSessionChange(d);
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [waSession?.status, waSession?.updated_at, userId, onSessionChange]);

  async function handleInit() {
    setInitLoading(true);
    onSessionChange({ ...(waSession ?? { id: "", user_id: userId ?? "", session_data: null, updated_at: "" }), status: "loading" });
    try {
      const res = await fetch("/api/wa/init", { method: "POST" });
      if (!res.ok) throw new Error("Gagal menginisialisasi");
      onToast("Berhasil memulai proses koneksi WhatsApp...", "info");
    } catch (e: any) {
      onToast(e.message || "Terjadi kesalahan", "error");
      handleRefreshStatus();
    } finally {
      setInitLoading(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/wa/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Gagal memutuskan koneksi");
      onSessionChange({ ...(waSession ?? { id: "", user_id: userId ?? "", updated_at: "" }), status: "disconnected", session_data: null });
      setGrupList([]);
      onToast("Koneksi berhasil diputuskan. Folder sesi telah dibersihkan.", "success");
    } catch (e: any) {
      onToast(e.message || "Gagal memutuskan koneksi", "error");
    } finally {
      setDisconnecting(false);
    }
  }

  const handleRefreshStatus = useCallback(async () => {
    setRefreshLoading(true);
    try {
      await fetch("/api/wa/sync-status", { method: "POST" });
      const supabase = createClient();
      const { data } = await supabase.from("wa_session").select("id, user_id, status, session_data, updated_at").eq("user_id", userId).maybeSingle();
      if (data) onSessionChange(data as WaSession);
      onToast("Status berhasil di-refresh!", "success");
    } catch (e: any) {
      onToast(e.message || "Gagal refresh status", "error");
    } finally {
      setRefreshLoading(false);
    }
  }, [userId, onSessionChange, onToast]);

  async function handlePairingCode() {
    if (!phoneNumber.trim()) return;
    setPairingLoading(true);
    try {
      const res = await fetch("/api/wa/pairing-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone_number: phoneNumber.trim() }) });
      if (!res.ok) throw new Error("Gagal mengambil kode");
      onToast("Memproses tautan dengan nomor...", "info");
    } catch (e: any) {
      onToast(e.message || "Terjadi kesalahan", "error");
    } finally {
      setPairingLoading(false);
    }
  }

  async function handleSaveGrupId() {
    try {
      const res = await fetch(`/api/ulp/${ulpId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wa_grup_id: waGrupId }) });
      if (!res.ok) throw new Error("Gagal menyimpan");
      onToast("ID Grup berhasil disimpan!", "success");
    } catch (e: any) {
      onToast(e.message || "Gagal menyimpan", "error");
    }
  }

  async function handleFetchGrup() {
    setLoadingGrup(true);
    try {
      const res = await fetch("/api/wa/groups", { method: "POST" });
      if (!res.ok) throw new Error("Gagal mengambil grup");
      const json = await res.json();
      setGrupList(json.data ?? []);
      onToast("Berhasil mengambil daftar grup", "success");
    } catch (e: any) {
      onToast(e.message || "Terjadi kesalahan", "error");
    } finally {
      setLoadingGrup(false);
    }
  }

  const sessionData = waSession?.session_data as { qr?: string; pairing_code?: string; wa_number?: string } | null;
  const qrDataUrl   = waSession?.status === "scanning" ? sessionData?.qr : null;
  const pairingCode = waSession?.status === "scanning" ? sessionData?.pairing_code : null;
  const waNumber    = waSession?.status === "connected" ? sessionData?.wa_number : null;

  const { label: statusLabel, bg: statusBg, text: statusText } = statusInfo(waSession?.status);

  const isConnected   = waSession?.status === WA_SESSION_STATUS.CONNECTED;
  const isLoading     = waSession?.status === WA_SESSION_STATUS.LOADING;
  const isScanning    = waSession?.status === WA_SESSION_STATUS.SCANNING;
  const isDisconnected = !waSession || waSession.status === WA_SESSION_STATUS.DISCONNECTED;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
        Koneksi WhatsApp
      </h2>

      {/* Status Card */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {/* Status Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", backgroundColor: statusBg, color: statusText }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{statusLabel}</span>
          <button
            onClick={handleRefreshStatus}
            disabled={refreshLoading}
            style={{ fontSize: 11, fontWeight: 500, opacity: 0.8, background: "none", border: "none", color: "inherit", cursor: "pointer", textDecoration: "underline" }}
          >
            {refreshLoading ? "memuat..." : "refresh"}
          </button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Connected info */}
          {isConnected && waNumber && (
            <div style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                Nomor WA: <span style={{ fontFamily: "monospace" }}>{waNumber}</span>
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>Nomor ini yang mengirim pesan ke grup</p>
            </div>
          )}

          {/* Pairing code */}
          {pairingCode && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 0" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, textAlign: "center" }}>Masukkan kode ini di WhatsApp HP kamu</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>WhatsApp → Setelan → Perangkat Tertaut → Tautkan via Nomor HP</p>
              <div style={{ padding: "12px 24px", borderRadius: 10, backgroundColor: "#FFD200", border: "1px solid #E6BD00", textAlign: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 32, letterSpacing: "0.15em", fontFamily: "monospace", color: "#0F172A" }}>{pairingCode}</span>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Kode berlaku beberapa menit</p>
            </div>
          )}

          {/* QR Code */}
          {qrDataUrl && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, textAlign: "center" }}>Scan QR ini dengan WhatsApp di HP Anda</p>
              <div style={{ padding: 8, borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                <Image src={qrDataUrl} alt="QR Code WhatsApp" width={240} height={240} unoptimized />
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>QR akan otomatis refresh jika kadaluarsa</p>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, height: 16, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Memulai WhatsApp client...</p>
            </div>
          )}

          {/* Disconnected — Connect options */}
          {isDisconnected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Button variant="primary" loading={initLoading} onClick={handleInit} style={{ width: "100%" }}>
                🔄 Hubungkan Kembali
              </Button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>atau tautkan ulang</span>
                <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
              </div>

              {/* Mode toggle */}
              <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {(["phone", "qr"] as const).map((mode, i) => (
                  <button
                    key={mode}
                    onClick={() => setLinkMode(mode)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "none",
                      borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                      backgroundColor: linkMode === mode ? "var(--accent)" : "var(--bg-surface-2)",
                      color: linkMode === mode ? "#fff" : "var(--text-secondary)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {mode === "phone" ? "📱 via Nomor HP" : "📷 via QR Code"}
                  </button>
                ))}
              </div>

              {linkMode === "phone" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Input type="tel" placeholder="Nomor WA (contoh: 08123456789)" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                  <Button variant="secondary" loading={pairingLoading} onClick={handlePairingCode} style={{ width: "100%" }}>Dapatkan Kode Tautan</Button>
                </div>
              )}
              {linkMode === "qr" && (
                <Button variant="secondary" loading={initLoading} onClick={handleInit} style={{ width: "100%" }}>Tampilkan QR Code</Button>
              )}
            </div>
          )}

          {/* Disconnect / Cancel button */}
          {(isConnected || isLoading || isScanning) && (
            <Button variant="danger" loading={disconnecting} onClick={handleDisconnect} style={{ width: "100%" }}>
              {isConnected ? "Putuskan Koneksi" : "Batalkan"}
            </Button>
          )}
        </div>
      </Card>

      {/* Grup WA Config */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Konfigurasi Grup WhatsApp</h3>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label="ID Grup WhatsApp"
            placeholder="628xxx@g.us"
            value={waGrupId}
            onChange={(e) => onGrupIdChange(e.target.value)}
            hint="Klik 'Ambil Daftar Grup' lalu pilih grup yang sesuai"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" loading={loadingGrup} onClick={handleFetchGrup} style={{ flex: 1 }}>
              📋 Ambil Daftar Grup
            </Button>
            <Button variant="primary" onClick={handleSaveGrupId} style={{ flex: 1 }}>Simpan</Button>
          </div>

          {grupList.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Pilih grup:</p>
              {grupList.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onGrupIdChange(g.id)}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    backgroundColor: waGrupId === g.id ? "var(--accent-subtle)" : "var(--bg-surface-2)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    outline: waGrupId === g.id ? "2px solid var(--accent)" : "none",
                    outlineOffset: -2,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: waGrupId === g.id ? 700 : 500, color: waGrupId === g.id ? "var(--accent)" : "var(--text-primary)" }}>{g.nama}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.id}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
