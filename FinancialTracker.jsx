import React, { useState, useEffect, useMemo } from "react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxO0i0d0TOJaBZ1TITVqVyNKtPYG6uEuMlVKHoeCx4YUIKI3xzS57AYN0gupkN-gecsIg/exec";

const CATEGORIES = {
  Makan: { color: "#e0533d", emoji: "🍜" },
  Bensin: { color: "#d99836", emoji: "⛽" },
  Groceries: { color: "#5a8f4e", emoji: "🛒" },
  Investasi: { color: "#3f6d9e", emoji: "📈" },
  Gaji: { color: "#7a5ba6", emoji: "💼" },
  Dll: { color: "#6b7280", emoji: "📦" },
};

const fmt = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");

export default function FinancialTracker() {
  const [tx, setTx] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState("keluar");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Makan");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("semua");
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | success | error
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("transactions");
        if (r && r.value) setTx(JSON.parse(r.value));
        const ls = await window.storage.get("lastSync");
        if (ls && ls.value) setLastSync(ls.value);
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  const persist = async (next) => {
    setTx(next);
    try {
      await window.storage.set("transactions", JSON.stringify(next));
    } catch (e) {
      console.error("Gagal menyimpan lokal:", e);
    }
  };

  const syncToSheets = async (data) => {
    setSyncStatus("syncing");
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", transactions: data }),
      });
      const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      setLastSync(now);
      await window.storage.set("lastSync", now);
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (e) {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  };

  const syncFromSheets = async () => {
    setSyncStatus("syncing");
    try {
      const res = await fetch(SCRIPT_URL + "?action=get");
      const json = await res.json();
      if (json.transactions) {
        const fetched = json.transactions.map(t => ({
          ...t,
          amount: parseFloat(t.amount),
        }));
        await persist(fetched);
        const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        setLastSync(now);
        await window.storage.set("lastSync", now);
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 3000);
      }
    } catch (e) {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  };

  const add = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    const entry = {
      id: Date.now(),
      type,
      amount: val,
      cat: type === "masuk" ? "Gaji" : cat,
      note: note.trim(),
      date: new Date().toISOString(),
    };
    const next = [entry, ...tx];
    await persist(next);
    setAmount("");
    setNote("");
    syncToSheets(next);
  };

  const remove = async (id) => {
    const next = tx.filter((t) => t.id !== id);
    await persist(next);
    syncToSheets(next);
  };

  const { masuk, keluar, saldo, byCat } = useMemo(() => {
    let masuk = 0, keluar = 0;
    const byCat = {};
    tx.forEach((t) => {
      if (t.type === "masuk") masuk += t.amount;
      else {
        keluar += t.amount;
        byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
      }
    });
    return { masuk, keluar, saldo: masuk - keluar, byCat };
  }, [tx]);

  const shown = tx.filter((t) => filter === "semua" ? true : t.type === filter);
  const maxCat = Math.max(1, ...Object.values(byCat));

  const syncLabel = {
    idle: lastSync ? `Tersinkron ${lastSync}` : "Belum disinkron",
    syncing: "Menyinkron…",
    success: "✓ Tersimpan di Sheets",
    error: "✗ Gagal sync",
  }[syncStatus];

  const syncColor = {
    idle: "#999",
    syncing: "#d99836",
    success: "#5a8f4e",
    error: "#e0533d",
  }[syncStatus];

  return (
    <div style={S.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Spline+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .tx-row { transition: background .15s; }
        .tx-row:hover { background: #f5f1e8; }
        .del-btn { opacity: 0; transition: opacity .15s; }
        .tx-row:hover .del-btn { opacity: 1; }
        input, select, button { font-family: 'Spline Sans', sans-serif; }
        input:focus, select:focus { outline: 2px solid #1a1a1a; outline-offset: 1px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinning { display: inline-block; animation: spin 1s linear infinite; }
      `}</style>

      <div style={S.container}>
        <header style={S.header}>
          <div style={S.titleRow}>
            <h1 style={S.title}>Keuangan</h1>
            <div style={S.syncArea}>
              <span style={{ ...S.syncLabel, color: syncColor }}>{syncLabel}</span>
              <button
                style={S.syncBtn}
                onClick={syncFromSheets}
                disabled={syncStatus === "syncing"}
                title="Ambil data dari Google Sheets"
              >
                <span className={syncStatus === "syncing" ? "spinning" : ""}>⟳</span>
              </button>
            </div>
          </div>
          <div style={S.saldoBox}>
            <span style={S.saldoLabel}>Saldo saat ini</span>
            <span style={{ ...S.saldoVal, color: saldo < 0 ? "#c0392b" : "#f7f3ea" }}>
              {fmt(saldo)}
            </span>
          </div>
        </header>

        <div style={S.statRow}>
          <div style={{ ...S.stat, borderColor: "#5a8f4e" }}>
            <span style={S.statLabel}>↓ Masuk</span>
            <span style={{ ...S.statVal, color: "#5a8f4e" }}>{fmt(masuk)}</span>
          </div>
          <div style={{ ...S.stat, borderColor: "#e0533d" }}>
            <span style={S.statLabel}>↑ Keluar</span>
            <span style={{ ...S.statVal, color: "#e0533d" }}>{fmt(keluar)}</span>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.toggle}>
            {["keluar", "masuk"].map((t) => (
              <button key={t} onClick={() => setType(t)} style={{
                ...S.toggleBtn,
                background: type === t ? "#1a1a1a" : "transparent",
                color: type === t ? "#f7f3ea" : "#1a1a1a",
              }}>
                {t === "keluar" ? "Pengeluaran" : "Pemasukan"}
              </button>
            ))}
          </div>
          <div style={S.formGrid}>
            <input style={S.input} type="number" placeholder="Jumlah (Rp)"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()} />
            {type === "keluar" && (
              <select style={S.input} value={cat} onChange={(e) => setCat(e.target.value)}>
                {Object.keys(CATEGORIES).filter((c) => c !== "Gaji").map((c) => (
                  <option key={c} value={c}>{CATEGORIES[c].emoji} {c}</option>
                ))}
              </select>
            )}
            <input
              style={{ ...S.input, gridColumn: type === "masuk" ? "1 / -1" : "auto" }}
              placeholder="Catatan (opsional)" value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()} />
          </div>
          <button style={S.addBtn} onClick={add}>+ Tambah & Sync</button>
        </div>

        {Object.keys(byCat).length > 0 && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>Pengeluaran per Kategori</h2>
            {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
              <div key={c} style={S.barRow}>
                <span style={S.barLabel}>{CATEGORIES[c]?.emoji} {c}</span>
                <div style={S.barTrack}>
                  <div style={{
                    ...S.barFill,
                    width: `${(v / maxCat) * 100}%`,
                    background: CATEGORIES[c]?.color || "#6b7280",
                  }} />
                </div>
                <span style={S.barVal}>{fmt(v)}</span>
              </div>
            ))}
          </div>
        )}

        <div style={S.card}>
          <div style={S.listHead}>
            <h2 style={S.cardTitle}>Riwayat</h2>
            <div style={S.filterRow}>
              {["semua", "masuk", "keluar"].map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  ...S.filterBtn,
                  background: filter === f ? "#1a1a1a" : "transparent",
                  color: filter === f ? "#f7f3ea" : "#777",
                }}>{f}</button>
              ))}
            </div>
          </div>
          {!loaded ? (
            <p style={S.empty}>Memuat…</p>
          ) : shown.length === 0 ? (
            <p style={S.empty}>Belum ada transaksi.</p>
          ) : (
            shown.map((t) => (
              <div key={t.id} className="tx-row" style={S.txRow}>
                <span style={{
                  ...S.dot,
                  background: t.type === "masuk" ? "#5a8f4e" : CATEGORIES[t.cat]?.color || "#6b7280",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.txCat}>
                    {t.type === "masuk" ? "💼 Pemasukan" : `${CATEGORIES[t.cat]?.emoji} ${t.cat}`}
                  </div>
                  <div style={S.txMeta}>
                    {new Date(t.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    {t.note && ` · ${t.note}`}
                  </div>
                </div>
                <span style={{ ...S.txAmt, color: t.type === "masuk" ? "#5a8f4e" : "#e0533d" }}>
                  {t.type === "masuk" ? "+" : "−"}{fmt(t.amount)}
                </span>
                <button className="del-btn" style={S.del} onClick={() => remove(t.id)}>✕</button>
              </div>
            ))
          )}
        </div>

        <div style={S.sheetsLink}>
          <a href="https://docs.google.com/spreadsheets/d/1aQ3cNuvmzE3Z3O4wo_mFIZWpuF6VztDhSCrtA_eXjW0" target="_blank" rel="noopener noreferrer" style={S.sheetsAnchor}>
            📊 Buka Google Sheets →
          </a>
        </div>
      </div>
    </div>
  );
}

const S = {
  wrap: { minHeight: "100vh", background: "#f7f3ea", padding: "32px 16px", fontFamily: "'Spline Sans', sans-serif", color: "#1a1a1a" },
  container: { maxWidth: 560, margin: "0 auto" },
  header: { marginBottom: 24 },
  titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 600, margin: 0, letterSpacing: "-0.02em" },
  syncArea: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 },
  syncLabel: { fontSize: 11, fontWeight: 500 },
  syncBtn: { background: "#1a1a1a", color: "#f7f3ea", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  saldoBox: { display: "flex", flexDirection: "column", background: "#1a1a1a", color: "#f7f3ea", padding: "20px 24px", borderRadius: 18 },
  saldoLabel: { fontSize: 13, opacity: 0.7, marginBottom: 4 },
  saldoVal: { fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 600 },
  statRow: { display: "flex", gap: 12, marginBottom: 16 },
  stat: { flex: 1, background: "#fff", border: "1px solid #e5ddc8", borderLeft: "4px solid", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column" },
  statLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  statVal: { fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600 },
  card: { background: "#fff", border: "1px solid #e5ddc8", borderRadius: 18, padding: 20, marginBottom: 16 },
  cardTitle: { fontFamily: "'Fraunces', serif", fontSize: 18, margin: "0 0 14px", fontWeight: 600 },
  toggle: { display: "flex", gap: 4, background: "#f0ead9", borderRadius: 12, padding: 4, marginBottom: 14 },
  toggleBtn: { flex: 1, border: "none", padding: "9px", borderRadius: 9, fontSize: 14, fontWeight: 500, cursor: "pointer" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 },
  input: { border: "1px solid #ddd3bc", borderRadius: 10, padding: "11px 13px", fontSize: 14, background: "#fdfbf6", width: "100%" },
  addBtn: { width: "100%", background: "#1a1a1a", color: "#f7f3ea", border: "none", borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 500, cursor: "pointer" },
  barRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  barLabel: { fontSize: 13, width: 95, flexShrink: 0 },
  barTrack: { flex: 1, height: 8, background: "#f0ead9", borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, transition: "width .4s ease" },
  barVal: { fontSize: 12, color: "#666", width: 90, textAlign: "right", flexShrink: 0 },
  listHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  filterRow: { display: "flex", gap: 4 },
  filterBtn: { border: "none", padding: "5px 11px", borderRadius: 8, fontSize: 12, cursor: "pointer", textTransform: "capitalize" },
  txRow: { display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderRadius: 10, margin: "0 -8px" },
  dot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  txCat: { fontSize: 14, fontWeight: 500 },
  txMeta: { fontSize: 12, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  txAmt: { fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", flexShrink: 0 },
  del: { background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 14, padding: 4 },
  empty: { textAlign: "center", color: "#aaa", fontSize: 14, padding: "20px 0" },
  sheetsLink: { textAlign: "center", paddingBottom: 16 },
  sheetsAnchor: { color: "#3f6d9e", fontSize: 13, textDecoration: "none", fontWeight: 500 },
};
