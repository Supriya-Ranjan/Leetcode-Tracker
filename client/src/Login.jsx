import { useState } from "react";
import { api } from "./api.js";
import PasswordInput from "./PasswordInput.jsx";

export default function Login({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fn = mode === "login" ? api.login : api.register;
      onAuth(await fn(username, password));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";
  return (
    <div className="wrap">
      <header>
        <h1>LeetCode Tracker</h1>
      </header>
      <div className="card auth">
        <h2>{isLogin ? "Sign in" : "Create an account"}</h2>
        <form onSubmit={submit}>
          <input
            className="full"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <PasswordInput
            className="full"
            placeholder="Password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="pri full" type="submit" disabled={busy}>
            {busy ? "Please wait…" : isLogin ? "Sign in" : "Sign up"}
          </button>
        </form>
        {error && <div className="note err">{error}</div>}
        <div className="note">
          {isLogin ? "No account yet? " : "Already have an account? "}
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(isLogin ? "register" : "login");
              setError("");
            }}
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
          {!isLogin && " The first account created becomes the admin."}
        </div>
      </div>
    </div>
  );
}
