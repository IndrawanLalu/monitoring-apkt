"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Regu } from "@/types";

interface UlpData {
  ulp: { id: string; nama: string; kode: string };
  reguList: Regu[];
}

interface Props {
  ulpsData: UlpData[];
  onToast: (text: string, type: "success" | "error" | "info") => void;
}

interface ImportResult {
  inserted: number;
  ulpNama: string;
  reguNama: string;
}

export function ImportTab({ ulpsData, onToast }: Props) {
  const [selectedUlpIdx, setSelectedUlpIdx] = useState(0);
  const [selectedReguId, setSelectedReguId] = useState<string>("");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const currentUlp = ulpsData[selectedUlpIdx]?.ulp;
  const currentReguList = ulpsData[selectedUlpIdx]?.reguList ?? [];

  const names = rawText
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  const selectedReguNama =
    selectedReguId
      ? (currentReguList.find((r) => r.id === selectedReguId)?.nama ?? "")
      : "Pool Umum";

  async function handleImport() {
    if (names.length === 0 || !currentUlp) return;
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/petugas/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ulp_id: currentUlp.id,
        regu_id: selectedReguId || null,
        names,
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok || json.error) {
      onToast(json.error ?? "Gagal import petugas", "error");
      return;
    }

    setResult({ inserted: json.inserted, ulpNama: currentUlp.nama, reguNama: selectedReguNama });
    setRawText("");
    onToast(`${json.inserted} petugas berhasil diimport ke ${currentUlp.nama} — ${selectedReguNama}`, "success");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
          Import Petugas Massal
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          Pilih ULP dan regu, lalu masukkan nama petugas satu per baris.
        </p>
      </div>

      {/* ULP Selector */}
      {ulpsData.length > 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            ULP
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ulpsData.map((d, idx) => (
              <button
                key={d.ulp.id}
                onClick={() => { setSelectedUlpIdx(idx); setSelectedReguId(""); setResult(null); }}
                style={{
                  padding: "5px 16px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: idx === selectedUlpIdx ? 700 : 500,
                  border: "2px solid",
                  borderColor: idx === selectedUlpIdx ? "var(--accent)" : "var(--border)",
                  backgroundColor: idx === selectedUlpIdx ? "var(--accent)" : "transparent",
                  color: idx === selectedUlpIdx ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {d.ulp.nama}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Regu Selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Regu (opsional)
        </label>
        <select
          value={selectedReguId}
          onChange={(e) => { setSelectedReguId(e.target.value); setResult(null); }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1.5px solid var(--border)",
            backgroundColor: "var(--bg-surface-2)",
            color: "var(--text-primary)",
            fontSize: 13,
            cursor: "pointer",
            outline: "none",
            maxWidth: 280,
          }}
        >
          <option value="">Pool Umum (tanpa regu)</option>
          {currentReguList.map((r) => (
            <option key={r.id} value={r.id}>{r.nama}</option>
          ))}
        </select>
      </div>

      {/* Textarea */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Nama Petugas — satu per baris
        </label>
        <textarea
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); setResult(null); }}
          placeholder={"Ahmad Fauzi\nBudi Santoso\nCandra Wijaya"}
          rows={10}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid var(--border)",
            backgroundColor: "var(--bg-surface-2)",
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "monospace",
            resize: "vertical",
            outline: "none",
            lineHeight: 1.6,
          }}
        />
        {names.length > 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            {names.length} nama terdeteksi
          </p>
        )}
      </div>

      {/* Preview target */}
      {names.length > 0 && (
        <div style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          backgroundColor: "var(--bg-surface-2)",
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}>
          Akan import <strong style={{ color: "var(--text-primary)" }}>{names.length} petugas</strong> ke{" "}
          <strong style={{ color: "var(--accent)" }}>{currentUlp?.nama}</strong>{" "}
          — <strong>{selectedReguNama}</strong>
        </div>
      )}

      <Button
        variant="primary"
        loading={loading}
        disabled={names.length === 0}
        onClick={handleImport}
        style={{ alignSelf: "flex-start", minWidth: 160 }}
      >
        {loading ? "Mengimport..." : `Import ${names.length > 0 ? names.length + " Petugas" : ""}`}
      </Button>

      {/* Hasil */}
      {result && (
        <div style={{
          padding: "12px 16px",
          borderRadius: 10,
          border: "2px solid #1DB954",
          backgroundColor: "rgba(29,185,84,0.08)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>✅</span>
          <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
            <strong>{result.inserted} petugas</strong> berhasil diimport ke{" "}
            <strong>{result.ulpNama}</strong> — {result.reguNama}
          </div>
        </div>
      )}
    </div>
  );
}
