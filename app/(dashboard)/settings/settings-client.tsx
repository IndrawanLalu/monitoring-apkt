"use client";

import { useState, useCallback, useEffect } from "react";
import type { Regu, Petugas, WaSessionStatus } from "@/types";
import { WaTab } from "./wa-tab";
import { ReguTab } from "./regu-tab";
import { PetugasTab } from "./petugas-tab";
import { CallbackTemplateTab } from "./callback-template-tab";
import { UsersTab } from "./users-tab";

interface WaSession {
  id: string;
  user_id: string;
  status: WaSessionStatus;
  session_data: Record<string, unknown> | null;
  updated_at: string;
}

interface Props {
  profile: {
    ulp_id: string;
    role: string;
    ulp: { id: string; nama: string; kode: string; wa_grup_id: string | null };
    userId?: string;
    ulps?: { id: string; nama: string; kode: string }[];
  };
  reguList: Regu[];
  petugasList: Petugas[];
  waSession: WaSession | null;
  templateCallback: string;
}

type Tab = "wa" | "regu" | "petugas" | "callback" | "users";

export function SettingsClient({
  profile,
  reguList: initialRegu,
  petugasList: initialPetugas,
  waSession: initialWa,
  templateCallback,
}: Props) {
  const [tab, setTab]             = useState<Tab>("wa");
  const [waSession, setWaSession] = useState<WaSession | null>(initialWa);
  const [reguList, setReguList]   = useState<Regu[]>(initialRegu);
  const [petugasList, setPetugasList] = useState<Petugas[]>(initialPetugas);
  const [waGrupId, setWaGrupId]   = useState(profile.ulp.wa_grup_id ?? "");
  const [toast, setToast]         = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    setReguList(initialRegu);
    setPetugasList(initialPetugas);
    setWaSession(initialWa);
    setWaGrupId(profile.ulp.wa_grup_id ?? "");
  }, [initialRegu, initialPetugas, initialWa, profile.ulp.wa_grup_id]);

  const showToast = useCallback((text: string, type: "success" | "error" | "info" = "info") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const toastColor = toast?.type === "success" ? "#1DB954" : toast?.type === "error" ? "#E4002B" : "var(--accent)";

  const tabs: { key: Tab; label: string }[] = [
    { key: "wa",       label: "📱 WhatsApp"          },
    { key: "regu",     label: "👷 Regu"               },
    { key: "petugas",  label: "👤 Petugas"            },
    { key: "callback", label: "📞 Template Callback"  },
    ...(profile.role === "admin" ? [{ key: "users" as Tab, label: "👥 Manajemen User CC" }] : []),
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
        {/* Toast Banner */}
        {toast && (
          <div style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            marginBottom: 16,
            padding: "10px 16px",
            borderRadius: 10,
            backgroundColor: toastColor,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "var(--shadow-md)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            {toast.type === "success" ? "✅" : toast.type === "error" ? "⚠️" : "ℹ️"}
            {toast.text}
          </div>
        )}

        {tab === "wa" && (
          <WaTab
            userId={profile.userId}
            ulpId={profile.ulp_id}
            waGrupId={waGrupId}
            onGrupIdChange={setWaGrupId}
            waSession={waSession}
            onSessionChange={setWaSession as any}
            onToast={showToast}
          />
        )}
        {tab === "regu" && (
          <ReguTab ulpId={profile.ulp_id} reguList={reguList} setReguList={setReguList} />
        )}
        {tab === "petugas" && (
          <PetugasTab
            ulpId={profile.ulp_id}
            reguList={reguList}
            petugasList={petugasList}
            setPetugasList={setPetugasList}
          />
        )}
        {tab === "callback" && (
          <CallbackTemplateTab ulpId={profile.ulp_id} initialTemplate={templateCallback} />
        )}
        {tab === "users" && (
          <UsersTab ulps={profile.ulps ?? []} onToast={showToast} />
        )}
      </div>
    </div>
  );
}
