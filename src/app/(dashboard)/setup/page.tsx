"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Database, Lock, ShieldCheck, Plus, Trash2, RefreshCw, Server,
  Save, AlertTriangle, Check, LogOut, HardDrive, Cloud, KeyRound,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const SETUP_API = "/api/setup";

type DbInfo = {
  id: string; type: string; name: string; status: string; active: boolean;
  location: string; note?: string; user?: string;
};
type ApiConfig = { key: string; endpoint?: string; databaseId?: string; savedAt?: string };

export default function SetupPage() {
  /* estado de sesión */
  const [hasMaster, setHasMaster] = useState<boolean | null>(null);
  const [token, setToken] = useState<string>("");
  const [pw, setPw] = useState("");
  const [loginError, setLoginError] = useState("");
  const [firstTime, setFirstTime] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  /* datos */
  const [databases, setDatabases] = useState<DbInfo[]>([]);
  const [apis, setApis] = useState<ApiConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  /* formularios */
  const [showRegDb, setShowRegDb] = useState(false);
  const [regType, setRegType] = useState("PostgreSQL");
  const [regName, setRegName] = useState("");
  const [regLocation, setRegLocation] = useState("");
  const [regUser, setRegUser] = useState("");

  const [apiName, setApiName] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [apiDb, setApiDb] = useState("sqlite-main");
  const [apiData, setApiData] = useState("");

  /* llamada con sesión */
  const call = useCallback(async (payload: any, useToken?: string) => {
    const t = useToken ?? token;
    const res = await fetch(SETUP_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    return { status: res.status, data: await res.json() };
  }, [token]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dbs, apiRes] = await Promise.all([
        call({ action: "list-databases" }),
        call({ action: "list-api-configs" }),
      ]);
      if (dbs.status === 200) setDatabases(dbs.data.databases || []);
      else if (dbs.status === 401) { setToken(""); setHasMaster(true); }
      if (apiRes.status === 200) setApis(apiRes.data.apis || []);
    } finally {
      setLoading(false);
    }
  }, [call]);

  /* estado inicial: ¿hay contraseña master configurada? */
  useEffect(() => {
    fetch(SETUP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status" }),
    })
      .then(r => r.json())
      .then(d => setHasMaster(!!d.hasMaster))
      .catch(() => setHasMaster(false));
  }, []);

  const handleLogin = async () => {
    setLoginError("");
    setLoggingIn(true);
    try {
      const res = await fetch(SETUP_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", password: pw }),
      });
      const d = await res.json();
      if (!res.ok) {
        setLoginError(d.error || "Error");
        return;
      }
      setToken(d.token);
      setFirstTime(!!d.firstTime);
      setPw("");
      loadData();
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const registerDb = async () => {
    if (!regName.trim()) { showToast("Ponle un nombre a la base", false); return; }
    const { status, data } = await call({
      action: "register-database",
      type: regType, name: regName, location: regLocation, username: regUser,
    });
    if (status === 200) {
      setShowRegDb(false);
      setRegName(""); setRegLocation(""); setRegUser("");
      showToast("Base registrada");
      loadData();
    } else {
      showToast(data.error || "Error", false);
    }
  };

  const removeDb = async (id: string) => {
    if (!confirm("¿Eliminar esta base del registro?")) return;
    await call({ action: "remove-database", id });
    showToast("Base eliminada del registro");
    loadData();
  };

  const saveApi = async () => {
    if (!apiName.trim()) { showToast("Nombra la API", false); return; }
    let parsed = null;
    if (apiData.trim()) {
      try { parsed = JSON.parse(apiData); }
      catch { showToast("Los datos extra no son JSON válido", false); return; }
    }
    const { status, data } = await call({
      action: "save-api-config",
      apiName, endpoint: apiEndpoint, databaseId: apiDb, data: parsed,
    });
    if (status === 200) {
      showToast(`API "${apiName}" guardada en ${apiDb}`);
      setApiName(""); setApiEndpoint(""); setApiData("");
      loadData();
    } else {
      showToast(data.error || "Error", false);
    }
  };

  const logout = () => {
    setToken("");
    setDatabases([]);
    setApis([]);
  };

  /* ---------- pantalla bloqueada ---------- */
  if (hasMaster === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#F97316] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center pt-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-accent-soft flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-[#F97316]" />
          </div>
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#F97316] mb-2">
            Zona restringida
          </p>
          <h1 className="text-2xl font-bold text-main">Setup de Bases de Datos</h1>
          <p className="text-muted mt-2 text-sm">
            {hasMaster
              ? "Ingresa la contraseña master para continuar."
              : "Primera vez: crea la contraseña master. Quedará guardada y nadie podrá ver este panel sin ella."}
          </p>
        </div>

        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-soft mb-1">
                Contraseña master {firstTime && <span className="text-dim">(mín. 8 caracteres)</span>}
              </label>
              <input
                type="password"
                value={pw}
                onChange={e => setPw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••••"
                className="input-theme w-full px-3 py-2.5 border border-soft rounded-lg text-main placeholder:text-dim focus-mdc"
                autoFocus
              />
            </div>
            {loginError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <Button onClick={handleLogin} loading={loggingIn} className="w-full">
              <KeyRound className="w-4 h-4 mr-2" />
              {hasMaster ? "Desbloquear" : "Crear contraseña y entrar"}
            </Button>
            <p className="text-xs text-dim flex items-center gap-1.5 justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
              5 intentos máximo · bloqueo de 10 minutos · sesión de 30 min
            </p>
          </div>
        </Card>
      </div>
    );
  }

  /* ---------- pantalla desbloqueada ---------- */
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#F97316] mb-2">Setup</p>
          <h1 className="text-2xl font-bold text-main">Bases de Datos y APIs</h1>
          <p className="text-muted mt-1">Sesión activa · expira en 30 minutos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={loadData} loading={loading}>
            <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-1" /> Salir
          </Button>
        </div>
      </div>

      {firstTime && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <span className="text-green-300 text-sm">
            Contraseña master creada y guardada (hasheada con scrypt). Desde ahora, este panel exige esa contraseña.
          </span>
        </div>
      )}

      {toast && (
        <div className={`rounded-lg p-4 text-sm flex items-start gap-3 border ${
          toast.ok
            ? "bg-green-500/10 border-green-500/30 text-green-300"
            : "bg-red-500/10 border-red-500/30 text-red-300"
        }`}>
          {toast.ok ? <Check className="w-5 h-5 mt-0.5" /> : <AlertTriangle className="w-5 h-5 mt-0.5" />}
          {toast.msg}
        </div>
      )}

      {/* ---------- BASES DE DATOS ---------- */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-main flex items-center gap-2">
            <Database className="w-5 h-5 text-[#F97316]" />
            Bases de datos disponibles
          </h2>
          <Button variant="secondary" size="sm" onClick={() => setShowRegDb(!showRegDb)}>
            <Plus className="w-4 h-4 mr-1" /> Registrar base
          </Button>
        </div>

        {showRegDb && (
          <div className="bg-card2 border border-card rounded-xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-soft mb-1">Tipo</label>
                <select value={regType} onChange={e => setRegType(e.target.value)}
                  className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-sm text-main focus-mdc">
                  {["PostgreSQL", "MySQL", "MariaDB", "MongoDB", "SQLite", "SQL Server", "Supabase", "Neon", "Otra"].map(t =>
                    <option key={t}>{t}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-soft mb-1">Nombre</label>
                <input value={regName} onChange={e => setRegName(e.target.value)}
                  placeholder="Ej: Ventas Producción" className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-sm text-main focus-mdc" />
              </div>
              <div>
                <label className="block text-sm font-medium text-soft mb-1">Ubicación / host <span className="text-dim">(opcional)</span></label>
                <input value={regLocation} onChange={e => setRegLocation(e.target.value)}
                  placeholder="Ej: db.example.com:5432/mdc" className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-sm text-main focus-mdc" />
              </div>
              <div>
                <label className="block text-sm font-medium text-soft mb-1">Usuario <span className="text-dim">(opcional)</span></label>
                <input value={regUser} onChange={e => setRegUser(e.target.value)}
                  placeholder="Ej: mdc_user" className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-sm text-main focus-mdc" />
              </div>
            </div>
            <p className="text-xs text-dim flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Las contraseñas de conexión nunca se guardan aquí — se piden al momento de conectar.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={registerDb}>Registrar</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowRegDb(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {databases.map(db => (
            <div key={db.id} className="flex items-center gap-3 p-3.5 bg-card2 border border-card rounded-xl">
              <div className={`p-2 rounded-lg flex-none ${
                db.active ? "bg-green-500/10" : "bg-accent-soft"
              }`}>
                {db.active
                  ? <Check className="w-4 h-4 text-green-400" />
                  : <HardDrive className="w-4 h-4 text-[#F97316]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-main">
                  {db.name}
                  <span className="ml-2 text-xs text-dim font-normal">{db.type}</span>
                </p>
                <p className="text-xs text-muted">{db.note} · {db.location}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-none ${
                db.active ? "bg-green-500/10 text-green-400" : "bg-accent-soft text-accent"
              }`}>
                {db.status}
              </span>
              {!db.active && (
                <button
                  onClick={() => removeDb(db.id)}
                  className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg flex-none"
                  title="Eliminar del registro"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ---------- GUARDAR APIs ---------- */}
      <Card>
        <h2 className="text-lg font-semibold text-main mb-1 flex items-center gap-2">
          <Server className="w-5 h-5 text-[#F97316]" />
          Guardar APIs en la base de datos
        </h2>
        <p className="text-sm text-muted mb-4">
          Registra una API con su endpoint y qué base debe usar. Queda bloqueado bajo la contraseña master.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-soft mb-1">Nombre de la API *</label>
              <input value={apiName} onChange={e => setApiName(e.target.value)}
                placeholder="Ej: catalogo-publico" className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-sm text-main focus-mdc" />
            </div>
            <div>
              <label className="block text-sm font-medium text-soft mb-1">Endpoint</label>
              <input value={apiEndpoint} onChange={e => setApiEndpoint(e.target.value)}
                placeholder="/api/public/catalog" className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-sm text-main focus-mdc" />
            </div>
            <div>
              <label className="block text-sm font-medium text-soft mb-1">Base de destino</label>
              <select value={apiDb} onChange={e => setApiDb(e.target.value)}
                className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-sm text-main focus-mdc">
                {databases.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-soft mb-1">
              Datos extra / colección <span className="text-dim">(JSON opcional)</span>
            </label>
            <textarea value={apiData} onChange={e => setApiData(e.target.value)}
              rows={3} placeholder='{ "table": "products", "sync": true }'
              className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-sm text-main focus-mdc font-mono" />
          </div>
          <Button onClick={saveApi}>
            <Save className="w-4 h-4 mr-2" /> Guardar configuración
          </Button>
        </div>

        {apis.length > 0 && (
          <div className="mt-5 pt-4 border-t border-card">
            <p className="text-sm font-semibold text-soft mb-2">APIs guardadas ({apis.length})</p>
            <div className="space-y-2">
              {apis.map(a => (
                <div key={a.key} className="flex items-center gap-3 p-3 bg-card2 border border-card rounded-lg text-sm">
                  <Cloud className="w-4 h-4 text-accent flex-none" />
                  <div className="flex-1 min-w-0">
                    <p className="text-main font-medium">{a.key}</p>
                    <p className="text-xs text-muted font-mono truncate">
                      {a.endpoint || "—"} → {databases.find(d => d.id === a.databaseId)?.name || a.databaseId}
                    </p>
                  </div>
                  <span className="text-xs text-dim flex-none">
                    {a.savedAt ? new Date(a.savedAt).toLocaleDateString("es-CL") : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}