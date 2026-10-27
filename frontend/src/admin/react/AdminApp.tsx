// ROLE: React root for the admin dashboard. Wraps the legacy ConfigEditor model.
import { useCallback, useEffect, useState } from "react";
import { ConfigEditor } from "../ConfigEditor";
import {
  AdminDashboard,
  type AdminNotice,
  type AdminTab,
  type ServerHealth,
} from "./AdminDashboard";
import { AdminLogin } from "./AdminLogin";
import { adminFetch } from "./adminApi";
import "../../styles/admin_react.css";

type AdminStatus = "loading" | "login" | "ready";

const EMPTY_HEALTH: ServerHealth = { online: false, players: 0, ping: 0 };

export function AdminApp() {
  const [editor, setEditor] = useState(() => new ConfigEditor());
  const [status, setStatus] = useState<AdminStatus>("loading");
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<AdminTab>("world_network");
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<ServerHealth>(EMPTY_HEALTH);
  const [notice, setNotice] = useState<AdminNotice | null>(null);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [restartOpen, setRestartOpen] = useState(false);

  const loadConfig = useCallback(async (currentEditor: ConfigEditor) => {
    setStatus("loading");
    const result = await currentEditor.load();
    if (result === "OK") {
      setLoginError("");
      setStatus("ready");
      setRevision((value) => value + 1);
      return;
    }
    setLoginError(result);
    setStatus("login");
  }, []);

  const checkSession = useCallback(
    async (currentEditor: ConfigEditor) => {
      setStatus("loading");
      try {
        const response = await adminFetch("/admin/session");
        const data = (await response.json()) as { authenticated?: boolean };
        if (data.authenticated) {
          await loadConfig(currentEditor);
          return;
        }
        setLoginError("");
        setStatus("login");
      } catch (error) {
        setLoginError(`Connection error: ${String(error)}`);
        setStatus("login");
      }
    },
    [loadConfig],
  );

  useEffect(() => {
    void checkSession(editor);
  }, [editor, checkSession]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;

    const poll = async () => {
      const started = performance.now();
      try {
        const response = await adminFetch("/health");
        const data = (await response.json()) as { players?: number };
        if (!cancelled) {
          setHealth({
            online: true,
            players: data.players ?? 0,
            ping: Math.round(performance.now() - started),
          });
        }
      } catch {
        if (!cancelled) setHealth(EMPTY_HEALTH);
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [status]);

  const handleLogin = async (password: string) => {
    setIsSubmitting(true);
    setLoginError("");
    try {
      const response = await adminFetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: string } | null;
        setLoginError(data?.detail || `Login failed (${response.status})`);
        return;
      }
      await loadConfig(editor);
    } catch (error) {
      setLoginError(`Connection error: ${String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await adminFetch("/admin/logout", { method: "POST" });
    } finally {
      setEditor(new ConfigEditor());
      setStatus("login");
      setLoginError("");
      setNotice(null);
    }
  };

  const handleFieldChange = (draftKey: string, value: string) => {
    editor.setDraft(draftKey, value);
    if (draftKey === "snake.growth_score_per_segment") {
      setFormulaError(null);
    }
    setRevision((current) => current + 1);
  };

  const handleResetFields = (draftKeys: string[]) => {
    const config = editor.getConfig();
    if (!config) return;
    for (const draftKey of draftKeys) {
      const [section, field] = draftKey.split(".");
      if (section && field) {
        editor.setDraft(draftKey, String(config[section]?.[field] ?? ""));
      }
    }
    setFormulaError(null);
    setRevision((current) => current + 1);
  };

  const handleResetAll = () => {
    editor.resetLocalDrafts();
    setFormulaError(null);
    setRevision((current) => current + 1);
  };

  const handleSave = async () => {
    const message = await editor.save();
    const isError =
      message.includes("Error") ||
      message.includes("error") ||
      message.includes("syntax") ||
      message.includes("formula");
    if (
      message.includes("Invalid password") ||
      message.includes("Invalid admin session") ||
      message.includes("Access error")
    ) {
      setStatus("login");
      setLoginError(message);
      return;
    }
    if (message.toLowerCase().includes("formula") || message.toLowerCase().includes("syntax")) {
      setFormulaError(message);
    }
    setNotice({ kind: isError ? "error" : "success", text: message });
    setRevision((current) => current + 1);
  };

  const handleRestart = async () => {
    setRestartOpen(false);
    try {
      const response = await adminFetch("/admin/restart", { method: "POST" });
      setNotice(
        response.ok
          ? { kind: "success", text: "Server restarted successfully." }
          : { kind: "error", text: `Restart failed: ${response.statusText}` },
      );
    } catch (error) {
      setNotice({ kind: "error", text: `Restart error: ${String(error)}` });
    }
  };

  if (status === "loading") {
    return (
      <div className="login-overlay">
        <div className="login-card glass-panel admin-login-card">
          <h2 className="login-logo">Admin Portal</h2>
          <p className="admin-login-caption">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (status === "login") {
    return <AdminLogin error={loginError} isSubmitting={isSubmitting} onSubmit={handleLogin} />;
  }

  return (
    <AdminDashboard
      editor={editor}
      revision={revision}
      tab={tab}
      query={query}
      health={health}
      notice={notice}
      formulaError={formulaError}
      restartOpen={restartOpen}
      onTabChange={setTab}
      onQueryChange={setQuery}
      onFieldChange={handleFieldChange}
      onResetFields={handleResetFields}
      onResetAll={handleResetAll}
      onRefresh={() => setRevision((current) => current + 1)}
      onSave={() => {
        void handleSave();
      }}
      onRestartClick={() => setRestartOpen(true)}
      onRestartConfirm={() => {
        void handleRestart();
      }}
      onRestartCancel={() => setRestartOpen(false)}
      onLogout={() => {
        void handleLogout();
      }}
      onNoticeClose={() => setNotice(null)}
    />
  );
}
