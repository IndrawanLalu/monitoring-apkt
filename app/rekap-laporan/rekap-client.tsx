"use client";

import { useState } from "react";
import type { StatusLaporan } from "@/types";

type StatusCount = Record<StatusLaporan, number>;

export interface LaporanItem {
  id: string;
  nomor_tiket: string;
  nama_pelanggan: string;
  keterangan: string | null;
  status: StatusLaporan;
}

export interface ReguSummary {
  id: string;
  nama: string;
  petugas: string[];
  stats: StatusCount;
  total: number;
  laporanAktif: LaporanItem[];
}

export interface UlpSummary {
  id: string;
  nama: string;
  stats: StatusCount;
  total: number;
  regus: ReguSummary[];
}

export interface Up3Group {
  up3Id: string;
  up3Nama: string;
  ulps: UlpSummary[];
  totalLaporan: number;
  totalStats: StatusCount;
  callback: {
    hariIni: number;
    bulanIni: number;
    statusCountHariIni: Record<string, number>;
  };
  survey: {
    hariIni: number;
    bulanIni: number;
  };
}

export interface RekapData {
  tanggal: string;
  totalLaporan: number;
  totalStats: StatusCount;
  up3Groups: Up3Group[];
}

const STATUS_GROUP_CONFIG: Record<
  StatusLaporan,
  { label: string; color: string; bg: string; icon: string }
> = {
  lapor: {
    label: "Dalam Antrian",
    color: "#92400E",
    bg: "#FEF3C7",
    icon: "📋",
  },
  penugasan_regu: {
    label: "Dalam Antrian",
    color: "#92400E",
    bg: "#FEF3C7",
    icon: "👷",
  },
  nyala_sementara: {
    label: "Dalam Antrian",
    color: "#92400E",
    bg: "#FEF3C7",
    icon: "💡",
  },
  ditangani: {
    label: "Sedang Ditangani",
    color: "#1E40AF",
    bg: "#DBEAFE",
    icon: "🔧",
  },
  selesai: { label: "Selesai", color: "#065F46", bg: "#D1FAE5", icon: "✅" },
};

function antrian(s: StatusCount) {
  return s.lapor + s.penugasan_regu + s.nyala_sementara;
}

// ─── Komponen kecil ────────────────────────────────────────────────────────

function BigStat({
  label,
  value,
  color,
  bg,
  sub,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "10px 6px",
        borderRadius: 12,
        backgroundColor: bg,
        border: `2px solid ${color}33`,
      }}
    >
      <span style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>
        {value}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginTop: 4,
          textAlign: "center",
        }}
      >
        {label}
      </span>
      {sub ? (
        <span
          style={{
            fontSize: 9,
            color,
            opacity: 0.7,
            marginTop: 2,
            textAlign: "center",
          }}
        >
          {sub}
        </span>
      ) : null}
    </div>
  );
}

function GroupChips({ stats }: { stats: StatusCount }) {
  const ant = antrian(stats);
  const dit = stats.ditangani;
  const sel = stats.selesai;
  if (ant + dit + sel === 0) {
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#6B7280",
          backgroundColor: "#F3F4F6",
          borderRadius: 6,
          padding: "2px 8px",
          border: "1px solid #E5E7EB",
          textTransform: "uppercase",
        }}
      >
        NIHIL
      </span>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {ant > 0 ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 6,
            padding: "2px 8px",
            backgroundColor: "#FEF3C7",
            color: "#92400E",
            border: "1px solid #F59E0B44",
          }}
        >
          {ant} Dalam Antrian
        </span>
      ) : null}
      {dit > 0 ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 6,
            padding: "2px 8px",
            backgroundColor: "#DBEAFE",
            color: "#1E40AF",
            border: "1px solid #3B82F644",
          }}
        >
          {dit} Sedang Ditangani
        </span>
      ) : null}
      {sel > 0 ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 6,
            padding: "2px 8px",
            backgroundColor: "#D1FAE5",
            color: "#065F46",
            border: "1px solid #10B98144",
          }}
        >
          {sel} Selesai
        </span>
      ) : null}
    </div>
  );
}

function MiniBar({ stats }: { stats: StatusCount }) {
  const total = antrian(stats) + stats.ditangani + stats.selesai;
  if (total === 0)
    return (
      <div style={{ height: 3, backgroundColor: "#E5E7EB", borderRadius: 2 }} />
    );
  const ant = antrian(stats);
  const dit = stats.ditangani;
  const sel = stats.selesai;
  return (
    <div
      style={{
        display: "flex",
        height: 3,
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: "#E5E7EB",
      }}
    >
      {ant > 0 ? (
        <div
          style={{
            width: `${(ant / total) * 100}%`,
            backgroundColor: "#F59E0B",
          }}
        />
      ) : null}
      {dit > 0 ? (
        <div
          style={{
            width: `${(dit / total) * 100}%`,
            backgroundColor: "#3B82F6",
          }}
        />
      ) : null}
      {sel > 0 ? (
        <div
          style={{
            width: `${(sel / total) * 100}%`,
            backgroundColor: "#10B981",
          }}
        />
      ) : null}
    </div>
  );
}

function LaporanList({ items }: { items: LaporanItem[] }) {
  if (items.length === 0) return null;
  return (
    <div
      style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}
    >
      {items.map((l) => {
        const cfg = STATUS_GROUP_CONFIG[l.status];
        return (
          <div
            key={l.id}
            style={{
              borderLeft: `3px solid ${cfg.color}`,
              paddingLeft: 8,
              paddingTop: 4,
              paddingBottom: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 4,
                  padding: "2px 6px",
                  backgroundColor: cfg.bg,
                  color: cfg.color,
                  border: `1px solid ${cfg.color}44`,
                  flexShrink: 0,
                }}
              >
                {cfg.icon} {cfg.label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>
                {l.nomor_tiket}
              </span>
              <span style={{ fontSize: 11, color: "#374151" }}>·</span>
              <span style={{ fontSize: 11, color: "#374151" }}>
                {l.nama_pelanggan}
              </span>
            </div>
            {l.keterangan ? (
              <p
                style={{
                  fontSize: 10,
                  color: "#6B7280",
                  margin: "2px 0 0",
                  lineHeight: 1.4,
                }}
              >
                {l.keterangan}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function RekapClient({ data }: { data: RekapData }) {
  const isMultiUp3 =
    data.up3Groups.length > 1 &&
    data.up3Groups.every((g) => g.up3Id !== "__all__");

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [expandedUlp, setExpandedUlp] = useState<Record<string, boolean>>(
    () => {
      const init: Record<string, boolean> = {};
      data.up3Groups.forEach((g) =>
        g.ulps.forEach((u) => {
          init[u.id] = u.total > 0;
        }),
      );
      return init;
    },
  );

  const group = data.up3Groups[selectedIdx] ?? data.up3Groups[0];
  const toggleUlp = (id: string) =>
    setExpandedUlp((prev) => ({ ...prev, [id]: !prev[id] }));

  function changeUp3(idx: number) {
    setSelectedIdx(idx);
    const next: Record<string, boolean> = {};
    data.up3Groups[idx]?.ulps.forEach((u) => {
      next[u.id] = u.total > 0;
    });
    setExpandedUlp(next);
  }

  const ant = antrian(group.totalStats);
  const dit = group.totalStats.ditangani;
  const sel = group.totalStats.selesai;
  const hasActive = ant + dit > 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F1F5F9",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ─── Header Sticky ─── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "linear-gradient(135deg, #003B8E 0%, #0055B3 100%)",
          boxShadow: "0 4px 20px rgba(0,59,142,0.3)",
        }}
      >
        {/* Title + tanggal */}
        <div
          style={{
            padding: "12px 16px 8px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>⚡</span>
              <h1
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#fff",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Outage Managemen
              </h1>
            </div>
            <p
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.6)",
                margin: "2px 0 0",
                fontWeight: 500,
              }}
            >
              Hari ini, — {data.tanggal}
            </p>
          </div>

          {/* UP3 selector — dropdown jika banyak, label jika hanya 1 */}
          {isMultiUp3 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Pilih UP3
              </span>
              <select
                value={selectedIdx}
                onChange={(e) => changeUp3(Number(e.target.value))}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "2px solid rgba(255,255,255,0.4)",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  cursor: "pointer",
                  outline: "none",
                  flexShrink: 0,
                }}
              >
                {data.up3Groups.map((g, i) => (
                  <option
                    key={g.up3Id}
                    value={i}
                    style={{ color: "#000", backgroundColor: "#fff" }}
                  >
                    {g.up3Nama}
                  </option>
                ))}
              </select>
            </div>
          ) : group.up3Nama ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 2,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                UP3
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "5px 10px",
                  borderRadius: 8,
                  border: "2px solid rgba(255,255,255,0.4)",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  color: "#fff",
                }}
              >
                {group.up3Nama}
              </span>
            </div>
          ) : null}
        </div>

        {/* 3 Stat Cards */}
        <div style={{ padding: "0 12px 12px", display: "flex", gap: 8 }}>
          <BigStat
            label="Dalam Antrian"
            value={ant}
            color="#B45309"
            bg="rgba(254,243,199,0.95)"
          />
          <BigStat
            label="Ditangani"
            value={dit}
            color="#1E40AF"
            bg="rgba(219,234,254,0.95)"
          />
          <BigStat
            label="Selesai"
            value={sel}
            color="#065F46"
            bg="rgba(209,250,229,0.95)"
          />
        </div>

        {/* Total + scope info */}
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.25)",
            padding: "8px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255,255,255,0.7)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Total · Gangguan hari ini
          </span>
          <span style={{ fontSize: 16, fontWeight: 900, color: "#FCD34D" }}>
            {group.totalLaporan}
          </span>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div
        style={{
          flex: 1,
          padding: "12px 12px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Alert gangguan aktif */}
        {hasActive ? (
          <div
            style={{
              backgroundColor: "#FEF3C7",
              border: "1.5px solid #F59E0B",
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18 }}>⚠️</span>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#92400E",
                margin: 0,
              }}
            >
              {ant + dit} gangguan belum selesai
            </p>
          </div>
        ) : null}

        {/* Card Callback + Survey (satu baris) */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            overflow: "hidden",
            border: "1.5px solid #E2E8F0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          {/* Header dua kolom */}
          <div style={{ display: "flex" }}>
            <div
              style={{
                flex: 1,
                backgroundColor: "#1D4ED8",
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>📞</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                CC Call Back
              </span>
            </div>
            <div
              style={{ width: 1, backgroundColor: "rgba(255,255,255,0.3)" }}
            />
            <div
              style={{
                flex: 1,
                backgroundColor: "#059669",
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>⭐</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                Feedback Pelanggan
              </span>
            </div>
          </div>

          {/* Stat boxes */}
          <div style={{ display: "flex", padding: "10px 10px", gap: 8 }}>
            {/* Callback: Hari Ini */}
            <div
              style={{
                flex: 1,
                textAlign: "center",
                padding: "8px 4px",
                backgroundColor: "#EFF6FF",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#1E40AF",
                  lineHeight: 1,
                }}
              >
                {group.callback.hariIni}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#1E40AF",
                  marginTop: 3,
                  textTransform: "uppercase",
                }}
              >
                Hari Ini
              </div>
            </div>
            {/* Callback: Bulan Ini */}
            <div
              style={{
                flex: 1,
                textAlign: "center",
                padding: "8px 4px",
                backgroundColor: "#DBEAFE",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#1D4ED8",
                  lineHeight: 1,
                }}
              >
                {group.callback.bulanIni}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#1D4ED8",
                  marginTop: 3,
                  textTransform: "uppercase",
                }}
              >
                Bulan Ini
              </div>
            </div>
            {/* Divider */}
            <div
              style={{
                width: 1,
                backgroundColor: "#E5E7EB",
                alignSelf: "stretch",
              }}
            />
            {/* Survey: Hari Ini */}
            <div
              style={{
                flex: 1,
                textAlign: "center",
                padding: "8px 4px",
                backgroundColor: "#ECFDF5",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#065F46",
                  lineHeight: 1,
                }}
              >
                {group.survey.hariIni}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#065F46",
                  marginTop: 3,
                  textTransform: "uppercase",
                }}
              >
                Hari Ini
              </div>
            </div>
            {/* Survey: Bulan Ini */}
            <div
              style={{
                flex: 1,
                textAlign: "center",
                padding: "8px 4px",
                backgroundColor: "#D1FAE5",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#047857",
                  lineHeight: 1,
                }}
              >
                {group.survey.bulanIni}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#047857",
                  marginTop: 3,
                  textTransform: "uppercase",
                }}
              >
                Bulan Ini
              </div>
            </div>
          </div>

          {/* Status breakdown callback (jika ada) */}
          {Object.keys(group.callback.statusCountHariIni).length > 0 ? (
            <div
              style={{
                padding: "0 10px 10px",
                display: "flex",
                gap: 5,
                flexWrap: "wrap",
              }}
            >
              {Object.entries(group.callback.statusCountHariIni).map(
                ([k, v]) => (
                  <span
                    key={k}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 20,
                      backgroundColor: "rgba(29,78,216,0.08)",
                      color: "#1D4ED8",
                      border: "1px solid rgba(29,78,216,0.2)",
                    }}
                  >
                    {v} {k}
                  </span>
                ),
              )}
            </div>
          ) : null}
        </div>

        {/* ─── ULP List ─── */}
        {group.ulps.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: "#9CA3AF",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Tidak ada ULP terdaftar.
          </div>
        ) : (
          group.ulps.map((ulp) => {
            const isExpanded = expandedUlp[ulp.id] ?? false;
            const ulpAnt = antrian(ulp.stats);
            const isNihil = ulp.total === 0;
            const hasUrgent = ulpAnt + ulp.stats.ditangani > 0;

            return (
              <div
                key={ulp.id}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: hasUrgent
                    ? "0 0 0 2px #F59E0B, 0 2px 8px rgba(0,0,0,0.06)"
                    : "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                {/* ULP Header toggle */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleUlp(ulp.id)}
                  onKeyDown={(e) => e.key === "Enter" && toggleUlp(ulp.id)}
                  style={{
                    cursor: "pointer",
                    userSelect: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "11px 14px",
                    gap: 12,
                    background: isNihil
                      ? "linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)"
                      : "linear-gradient(135deg, #003B8E 0%, #0055B3 100%)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        margin: 0,
                        color: isNihil ? "#374151" : "#fff",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {ulp.nama}
                    </p>
                    <div style={{ marginTop: 5 }}>
                      <GroupChips stats={ulp.stats} />
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: isNihil ? "#9CA3AF" : "rgba(255,255,255,0.8)",
                      flexShrink: 0,
                    }}
                  >
                    {isExpanded ? "−" : "+"}
                  </span>
                </div>

                <MiniBar stats={ulp.stats} />

                {/* Regu list (expanded) */}
                {isExpanded ? (
                  <div
                    style={{
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      backgroundColor: "#FAFAFA",
                    }}
                  >
                    {ulp.regus.length === 0 ? (
                      <p
                        style={{
                          fontSize: 12,
                          textAlign: "center",
                          color: "#9CA3AF",
                          fontWeight: 600,
                          padding: "8px 0",
                        }}
                      >
                        Tidak ada regu terdaftar.
                      </p>
                    ) : (
                      ulp.regus.map((regu) => {
                        const reguAnt = antrian(regu.stats);
                        const hasUrgentRegu =
                          reguAnt + regu.stats.ditangani > 0;
                        return (
                          <div
                            key={regu.id}
                            style={{
                              backgroundColor: "#fff",
                              borderRadius: 10,
                              overflow: "hidden",
                              border: hasUrgentRegu
                                ? "1.5px solid #F59E0B"
                                : "1.5px solid #E5E7EB",
                            }}
                          >
                            <div style={{ padding: "10px 12px" }}>
                              {/* Regu header */}
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 8,
                                  marginBottom: 6,
                                }}
                              >
                                <p
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: "#111827",
                                    margin: 0,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.02em",
                                  }}
                                >
                                  {regu.nama}
                                </p>
                                <GroupChips stats={regu.stats} />
                              </div>

                              <MiniBar stats={regu.stats} />

                              {/* Petugas piket */}
                              <div
                                style={{
                                  marginTop: 8,
                                  padding: "6px 10px",
                                  borderRadius: 7,
                                  backgroundColor: "#FFFBEB",
                                  border: "1px solid #FDE68A",
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 6,
                                }}
                              >
                                <span style={{ fontSize: 12, flexShrink: 0 }}>
                                  👷
                                </span>
                                <div>
                                  <p
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 700,
                                      color: "#92400E",
                                      margin: "0 0 1px",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    Petugas Piket Aktif
                                  </p>
                                  <p
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: "#374151",
                                      margin: 0,
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {regu.petugas.length > 0 ? (
                                      regu.petugas.join(" · ")
                                    ) : (
                                      <span
                                        style={{
                                          color: "#9CA3AF",
                                          fontStyle: "italic",
                                          fontWeight: 400,
                                        }}
                                      >
                                        Tidak ada petugas terdata
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Laporan belum selesai */}
                              <LaporanList items={regu.laporanAktif} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          padding: "12px 16px",
          backgroundColor: "#F8FAFC",
          borderTop: "1px solid #E2E8F0",
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#94A3B8",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          APKT Monitoring · PLN
        </p>
      </div>
    </div>
  );
}
