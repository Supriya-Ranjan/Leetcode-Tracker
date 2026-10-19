import { useState } from "react";
import { api } from "./api.js";
import PasswordInput from "./PasswordInput.jsx";

const TITLES = { login: "Sign in", register: "Create an account", forgot: "Reset your password" };

export default function Login({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);

  function go(m) {
    setMode(m);
    setError("");
    setSentTo("");
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") onAuth(await api.login(username, password));
      else if (mode === "register") onAuth(await api.register(username, email, password));
      else {
        await api.forgot(email);
        setSentTo(email.trim());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>LeetCode Tracker</h1>
      </header>
      <div className="card auth">
        <h2>{TITLES[mode]}</h2>

        {mode === "forgot" && sentTo ? (
          <div className="sent">
            <p>
              If an account uses <b>{sentTo}</b>, we've sent it a link to reset the password. It expires in 30 minutes.
            </p>
            <p className="note">Don't see it? Check your spam folder, or wait a minute and try again.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "forgot" && (
              <p className="note full">
                Enter the email on your account and we'll send you a link to set a new password.
              </p>
            )}
            {mode !== "forgot" && (
              <input
                className="full"
                placeholder={mode === "login" ? "Username or email" : "Username"}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            )}
            {mode !== "login" && (
              <input
                className="full"
                type="email"
                placeholder="Email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            )}
            {mode !== "forgot" && (
              <PasswordInput
                className="full"
                placeholder="Password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}
            {mode === "login" && (
              <div className="full forgot">
                <button type="button" className="link muted" onClick={() => go("forgot")}>
                  Forgot password?
                </button>
              </div>
            )}
            <button className="pri full" type="submit" disabled={busy}>
              {busy ? "Please wait…" : { login: "Sign in", register: "Sign up", forgot: "Send reset link" }[mode]}
            </button>
          </form>
        )}

        {error && <div className="note err">{error}</div>}
        <div className="note">
          {mode === "login" ? (
            <>
              No account yet?{" "}
              <button type="button" className="link" onClick={() => go("register")}>
                Sign up
              </button>
            </>
          ) : mode === "register" ? (
            <>
              Already have an account?{" "}
              <button type="button" className="link" onClick={() => go("login")}>
                Sign in
              </button>
            </>
          ) : (
            <button type="button" className="link" onClick={() => go("login")}>
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
