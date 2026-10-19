import { useState } from "react";
import { api } from "./api.js";
import PasswordInput from "./PasswordInput.jsx";

// Opened from the emailed link: /reset-password?token=...
export default function ResetPassword({ token, onAuth, onCancel }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    setError("");
    try {
      onAuth(await api.reset(token, password));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>LeetCode Tracker</h1>
      </header>
      <div className="card auth">
        <h2>Choose a new password</h2>
        {token ? (
          <form onSubmit={submit}>
            <PasswordInput
              className="full"
              placeholder="New password"
              autoComplete="new-password"
              minLength={6}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <PasswordInput
              className="full"
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button className="pri full" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Set password and sign in"}
            </button>
          </form>
        ) : (
          <p className="note err">This reset link is missing its token. Please use the link from your email.</p>
        )}
        {error && <div className="note err">{error}</div>}
        <div className="note">
          <button type="button" className="link" onClick={onCancel}>
            ← Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
}
