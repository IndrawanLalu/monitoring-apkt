"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { Regu } from "@/types";

interface Props {
  ulpId: string;
  reguList: Regu[];
  setReguList: React.Dispatch<React.SetStateAction<Regu[]>>;
}

export function ReguTab({ ulpId, reguList, setReguList }: Props) {
  const [namaRegu, setNamaRegu] = useState("");
  const [nomorHpRegu, setNomorHpRegu] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editNomorHp, setEditNomorHp] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  async function handleTambah() {
    if (!namaRegu.trim()) return;
    setLoading(true);
    const res = await fetch("/api/regu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ulp_id: ulpId, nama: namaRegu.trim(), nomor_hp: nomorHpRegu.trim() || null }),
    });
    const json = await res.json();
    if (json.data) {
      setReguList((prev) => [...prev, json.data].sort((a, b) => a.nama.localeCompare(b.nama)));
      setNamaRegu("");
      setNomorHpRegu("");
    }
    setLoading(false);
  }

  function startEdit(regu: Regu) {
    setEditingId(regu.id);
    setEditNama(regu.nama);
    setEditNomorHp(regu.nomor_hp ?? "");
  }

  async function handleSaveEdit(id: string) {
    setEditLoading(true);
    const res = await fetch(`/api/regu/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama: editNama.trim(), nomor_hp: editNomorHp.trim() || null }),
    });
    const json = await res.json();
    if (json.data) {
      setReguList((prev) => prev.map((r) => (r.id === id ? json.data : r)));
      setEditingId(null);
    }
    setEditLoading(false);
  }

  async function handleHapus(id: string) {
    if (!confirm("Hapus regu ini? Semua petugas di regu ini akan kehilangan regu.")) return;
    await fetch(`/api/regu/${id}`, { method: "DELETE" });
    setReguList((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div style={{ maxWidth: 540, margin: "0 auto" }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.01em" }}>
        Manajemen Regu
      </h2>

      {/* Form Tambah */}
      <Card style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--accent-subtle)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", margin: 0 }}>+ Tambah Regu</h3>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Input
                placeholder="Nama regu (contoh: Regu 1)"
                value={namaRegu}
                onChange={(e) => setNamaRegu(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTambah()}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                placeholder="No. HP (opsional)"
                value={nomorHpRegu}
                onChange={(e) => setNomorHpRegu(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTambah()}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="primary" loading={loading} onClick={handleTambah}>Tambah</Button>
          </div>
        </div>
      </Card>

      {/* List Regu */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {reguList.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 10, backgroundColor: "var(--bg-surface-2)" }}>
            Belum ada regu
          </div>
        )}
        {reguList.map((regu) => (
          <div
            key={regu.id}
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}
          >
            {editingId === regu.id ? (
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <Input value={editNama} onChange={(e) => setEditNama(e.target.value)} placeholder="Nama regu" />
                  <Input value={editNomorHp} onChange={(e) => setEditNomorHp(e.target.value)} placeholder="No. HP" />
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>Batal</Button>
                  <Button variant="primary" size="sm" loading={editLoading} onClick={() => handleSaveEdit(regu.id)}>Simpan</Button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{regu.nama}</p>
                  {regu.nomor_hp && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{regu.nomor_hp}</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Button variant="secondary" size="sm" onClick={() => startEdit(regu)}>Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => handleHapus(regu.id)}>Hapus</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
