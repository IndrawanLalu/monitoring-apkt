"use client";

import { useState, useCallback, type Dispatch, type SetStateAction } from "react";
import type { Regu, Petugas, WaSessionStatus } from "@/types";
import { WaTab } from "./wa-tab";
import { ReguTab } from "./regu-tab";
import { PetugasTab } from "./petugas-tab";
import { CallbackTemplateTab } from "./callback-template-tab";
import { UsersTab } from "./users-tab";
import { UlpsTab } from "./ulps-tab";
import { ImportTab } from "./import-tab";

interface WaSession {
  id: string;
  user_id: string;
  status: WaSessionStatus;
  session_data: Record<string, unknown> | null;
  updated_at: string;
}

interface UlpData {
  ulp: { id: string; nama: string; kode: string };
  reguList: Regu[];
  petugasList: Petugas[];
  templateCallback: string;
  waGrupId: string;
}

interface Props {
  ulpsData: UlpData[];
  profile: {
    role: string;
    userId?: string;
    up3Id?: string | null;
    ulps?: { id: string; nama: string; kode: string }[];
  };
  waSession: WaSession | null;
}

type Tab = "wa" | "regu" | "petugas" | "callback" | "users" | "ulps" | "import";

export function SettingsClient({ ulpsData, profile, waSession: initialWa }: Props) {
  const [tab, setTab] = useState<Tab>("wa");
  const [waSession, setWaSession] = useState<WaSession | null>(initialWa);
  const [selectedUlpIdx, setSelectedUlpIdx] = useState(0);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const [ulpStates, setUlpStates] = useState(() =>
    ulpsData.map((d) => ({
      reguList: d.reguList,
      petugasList: d.petugasList,
      waGrupId: d.waGrupId,
    }))
  );

  const current = ulpsData[selectedUlpIdx];
  const currentState = ulpStates[selectedUlpIdx];

  function setCurrentReguList(action: SetStateAction<Regu[]>) {
    setUlpStates((prev) => prev.map((s, i) => {
      if (i !== selectedUlpIdx) return s
      const reguList = typeof action === 'function' ? action(s.reguList) : action
      return { ...s, reguList }
    }))
  }
  function setCurrentPetugasList(action: SetStateAction<Petugas[]>) {
    setUlpStates((prev) => prev.map((s, i) => {
      if (i !== selectedUlpIdx) return s
      const petugasList = typeof action === 'function' ? action(s.petugasList) : action
      return { ...s, petugasList }
    }))
  }
  function setCurrentWaGrupId(waGrupId: string) {
    setUlpStates((prev) => prev.map((s, i) => i === selectedUlpIdx ? { ...s, waGrupId } : s));
  }

  const showToast = useCallback((text: string, type: "success" | "error" | "info" = "info") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const toastColor = toast?.type === "success" ? "#1DB954" : toast?.type === "error" ? "#E4002B" : "var(--accent)";

  // Peran pengelola: super_admin, uiw, up3 — plus 'admin' lama supaya akun
  // yang belum termigrasi tidak kehilangan menu pengaturannya.
  const bolehKelola = ["super_admin", "uiw", "up3", "admin"].includes(profile.role)

  const tabs: { key: Tab; label: string }[] = [
    { key: "wa",       label: "📱 WhatsApp"         },
    { key: "regu",     label: "👷 Regu"              },
    { key: "petugas",  label: "👤 Petugas"           },
    { key: "callback", label: "📞 Template Callback" },
    ...(bolehKelola ? [{ key: "users" as Tab, label: "👥 Manajemen User" }] : []),
    ...(bolehKelola && profile.up3Id ? [{ key: "ulps" as Tab, label: "🏢 Kelola ULP" }] : []),
    ...(bolehKelola ? [{ key: "import" as Tab, label: "📥 Import Petugas" }] : []),
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ULP Selector — hanya tampil jika lebih dari 1 ULP */}
      {ulpsData.length > 1 && (
        <div style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 20px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-surface)",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>ULP:</span>
          {ulpsData.map((d, idx) => (
            <button
              key={d.ulp.id}
              onClick={() => setSelectedUlpIdx(idx)}
              style={{
                padding: "4px 14px",
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
      )}

      {/* Tab Bar */}
      <div style={{ flexShrink: 0, display: "flex", borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", overflowX: "auto" }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "11px 18px",
              fontSize: 13,
              fontWeight: tab === key ? 700 : 500,
              whiteSpace: "nowrap",
              border: "none",
              borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent",
              backgroundColor: "transparent",
              color: tab === key ? "var(--accent)" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={e => { if (tab !== key) e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={e => { if (tab !== key) e.currentTarget.style.color = "var(--text-secondary)"; }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20, position: "relative" }}>
        {toast && (
          <div style={{
            position: "sticky", top: 0, zIndex: 50, marginBottom: 16,
            padding: "10px 16px", borderRadius: 10, backgroundColor: toastColor,
            color: "#fff", fontSize: 13, fontWeight: 600,
            boxShadow: "var(--shadow-md)", display: "flex", alignItems: "center", gap: 8,
          }}>
            {toast.type === "success" ? "✅" : toast.type === "error" ? "⚠️" : "ℹ️"}
            {toast.text}
          </div>
        )}

        {tab === "wa" && (
          <WaTab
            userId={profile.userId}
            ulpId={current.ulp.id}
            waGrupId={currentState.waGrupId}
            onGrupIdChange={setCurrentWaGrupId}
            waSession={waSession}
            onSessionChange={setWaSession as never}
            onToast={showToast}
          />
        )}
        {tab === "regu" && (
          <ReguTab ulpId={current.ulp.id} reguList={currentState.reguList} setReguList={setCurrentReguList} />
        )}
        {tab === "petugas" && (
          <PetugasTab
            ulpId={current.ulp.id}
            reguList={currentState.reguList}
            petugasList={currentState.petugasList}
            setPetugasList={setCurrentPetugasList}
          />
        )}
        {tab === "callback" && (
          <CallbackTemplateTab key={current.ulp.id} ulpId={current.ulp.id} initialTemplate={current.templateCallback} />
        )}
        {tab === "users" && (
          <UsersTab ulps={profile.ulps ?? []} onToast={showToast} />
        )}
        {tab === "ulps" && (
          <UlpsTab onToast={showToast} />
        )}
        {tab === "import" && (
          <ImportTab
            ulpsData={ulpsData.map((d, i) => ({ ulp: d.ulp, reguList: ulpStates[i].reguList }))}
            onToast={showToast}
          />
        )}
      </div>
    </div>
  );
}
