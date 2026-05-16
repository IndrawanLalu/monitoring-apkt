"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { Regu, Petugas } from "@/types";

interface Props {
  ulpId: string;
  reguList: Regu[];
  petugasList: Petugas[];
  setPetugasList: React.Dispatch<React.SetStateAction<Petugas[]>>;
}

export function PetugasTab({ ulpId, reguList, petugasList, setPetugasList }: Props) {
  const [nama, setNama] = useState("");
  const [nomorHp, setNomorHp] = useState("");
  const [reguId, setReguId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleTambah() {
    if (!nama.trim()) return;
    setLoading(true);
    const res = await fetch("/api/petugas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ulp_id: ulpId, regu_id: reguId || null, nama: nama.trim(), nomor_hp: nomorHp || null }),
    });
    const json = await res.json();
    if (json.data) {
      setPetugasList((prev) => [...prev, json.data].sort((a, b) => a.nama.localeCompare(b.nama)));
      setNama("");
      setNomorHp("");
    }
    setLoading(false);
  }

  async function handleHapus(id: string) {
    if (!confirm("Hapus petugas ini?")) return;
    await fetch(`/api/petugas/${id}`, { method: "DELETE" });
    setPetugasList((prev) => prev.filter((p) => p.id !== id));
  }

  const reguMap = Object.fromEntries(reguList.map((r) => [r.id, r.nama]));

  return (
    <div style={{ maxWidth: 540, margin: "0 auto" }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.01em" }}>
        Manajemen Petugas
      </h2>

      {/* Form Tambah */}
      <Card style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--accent-subtle)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", margin: 0 }}>+ Tambah Petugas</h3>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="Nama Petugas" placeholder="Budi Santoso" value={nama} onChange={(e) => setNama(e.target.value)} />
          <Input label="Nomor HP" placeholder="081234567890" value={nomorHp} onChange={(e) => setNomorHp(e.target.value)} />
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                Regu Default <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opsional)</span>
              </label>
              <select
                value={reguId}
                onChange={(e) => setReguId(e.target.value)}
                className="input"
                style={{ cursor: "pointer" }}
              >
                <option value="">— Tanpa regu default —</option>
                {reguList.map((r) => (
                  <option key={r.id} value={r.id}>{r.nama}</option>
                ))}
              </select>
            </div>
            <Button variant="primary" loading={loading} onClick={handleTambah}>Tambah</Button>
          </div>
        </div>
      </Card>

      {/* List Petugas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {petugasList.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 10, backgroundColor: "var(--bg-surface-2)" }}>
            Belum ada petugas
          </div>
        )}
        {petugasList.map((p) => (
          <div
            key={p.id}
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{p.nama}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {p.regu_id ? (reguMap[p.regu_id] ?? "—") : "Pool umum"}
                {p.nomor_hp ? ` · ${p.nomor_hp}` : ""}
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={() => handleHapus(p.id)}>Hapus</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
