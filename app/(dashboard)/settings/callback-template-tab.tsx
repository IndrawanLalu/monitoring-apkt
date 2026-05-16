"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  ulpId: string;
  initialTemplate: string;
}

const VARIABLES = [
  "{nama}", "{nomor_tiket}", "{lokasi}", "{regu}",
  "{ulp}", "{keterangan}", "{link_antrian}", "{no_hp}",
];

export function CallbackTemplateTab({ ulpId, initialTemplate }: Props) {
  const [template, setTemplate] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/ulp/${ulpId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wa_template_callback: template }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
        Template Pesan CC Callback
      </h2>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
            Pesan yang dikirim ke pelanggan
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 6px" }}>
            Gunakan variabel berikut dalam template:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {VARIABLES.map((v) => (
              <code
                key={v}
                onClick={() => {
                  setTemplate((prev) => prev + v);
                  setSaved(false);
                }}
                title="Klik untuk sisipkan"
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 5,
                  backgroundColor: "var(--accent-subtle)",
                  color: "var(--accent)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  fontFamily: "monospace",
                  transition: "all 0.15s ease",
                }}
              >
                {v}
              </code>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>
            Format WA: <code style={{ backgroundColor: "var(--bg-surface-3)", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>*teks tebal*</code>
          </p>
        </div>

        {/* Editor */}
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <textarea
            rows={12}
            value={template}
            onChange={(e) => { setTemplate(e.target.value); setSaved(false); }}
            className="input"
            placeholder="Tulis template pesan di sini..."
            style={{ fontFamily: "monospace", fontSize: 13, resize: "vertical", lineHeight: 1.6 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button variant="primary" loading={saving} onClick={handleSave} style={{ flex: 1 }}>
              Simpan Template
            </Button>
            {saved && (
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1DB954" }}>✓ Tersimpan</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
