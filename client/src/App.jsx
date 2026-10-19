import { useEffect, useState } from "react";
import { api, setToken, getToken } from "./api.js";
import Login from "./Login.jsx";
import ResetPassword from "./ResetPassword.jsx";
import Tracker from "./Tracker.jsx";

// The emailed reset link opens /reset-password?token=...
function readResetToken() {
  if (window.location.pathname !== "/reset-password") return null;
  return new URLSearchParams(window.location.search).get("token") || "";
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [resetToken, setResetToken] = useState(readResetToken);

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  function leaveReset() {
    window.history.replaceState(null, "", "/");
    setResetToken(null);
  }

  function onAuth({ token, user }) {
    setToken(token);
    setUser(user);
    if (resetToken !== null) leaveReset();
  }

  async function logout() {
    try {
      await api.logout();
    } catch {}
    setToken(null);
    setUser(null);
  }

  if (resetToken !== null) return <ResetPassword token={resetToken} onAuth={onAuth} onCancel={leaveReset} />;

  if (checking)
    return (
      <div className="wrap">
        <div className="card">
          <div className="empty">Loading…</div>
        </div>
      </div>
    );

  return user ? <Tracker user={user} onLogout={logout} onUserChange={setUser} /> : <Login onAuth={onAuth} />;
}
