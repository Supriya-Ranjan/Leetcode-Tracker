import { useEffect, useState } from "react";
import { api, setToken, getToken } from "./api.js";
import Login from "./Login.jsx";
import Tracker from "./Tracker.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  function onAuth({ token, user }) {
    setToken(token);
    setUser(user);
  }

  async function logout() {
    try {
      await api.logout();
    } catch {}
    setToken(null);
    setUser(null);
  }

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
