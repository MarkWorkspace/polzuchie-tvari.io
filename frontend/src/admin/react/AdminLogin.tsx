// ROLE: React login screen for the admin dashboard. Not game logic.
import { type ChangeEvent, type FormEvent, useState } from "react";

interface AdminLoginProps {
  error: string;
  isSubmitting: boolean;
  onSubmit: (password: string) => Promise<void>;
}

export function AdminLogin({ error, isSubmitting, onSubmit }: AdminLoginProps) {
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim() || isSubmitting) return;
    await onSubmit(password);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword((event.currentTarget as HTMLInputElement).value);
  };

  return (
    <div className="login-overlay">
      <form className="login-card glass-panel admin-login-card" onSubmit={handleSubmit}>
        <h2 className="login-logo">Admin Portal</h2>
        <p className="admin-login-caption">Authorize to manage the live game configuration.</p>
        <div className="login-form">
          <input
            type="password"
            className="input-field"
            placeholder="Enter admin password"
            value={password}
            onChange={handleChange}
            autoComplete="current-password"
            aria-label="Admin password"
          />
          <button
            type="submit"
            className="login-button"
            disabled={isSubmitting || !password.trim()}
          >
            {isSubmitting ? "Authorizing..." : "Authorize"}
          </button>
        </div>
        <div className={`admin-login-status ${error ? "is-error" : ""}`} role="status">
          {error || "Enter the password to continue."}
        </div>
      </form>
    </div>
  );
}
