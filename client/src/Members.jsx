import { useEffect, useState } from "react";
import { api } from "./api.js";
import Avatar from "./Avatar.jsx";

export default function Members({ me }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api
      .users()
      .then(setUsers)
      .catch((e) => setError(e.message));
  }, []);

  async function setRole(u, isAdmin) {
    if (!isAdmin && !confirm(`Remove admin rights from ${u.username}?`)) return;
    setBusyId(u.id);
    setError("");
    try {
      const saved = await api.setRole(u.id, isAdmin);
      setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, isAdmin: saved.isAdmin } : x)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!users)
    return (
      <div className="card">
        <div className="empty">{error || "Loading…"}</div>
      </div>
    );

  const admins = users.filter((u) => u.isAdmin).length;
  return (
    <div className="card">
      <h2>
        Members · {users.length} total, {admins} admin{admins === 1 ? "" : "s"}
      </h2>
      {error && <div className="note err">{error}</div>}
      {users.map((u) => (
        <div className="row" key={u.id}>
          <Avatar user={u} size={36} />
          <div className="info">
            <div className="t">
              {u.name || u.username}
              {u.id === me.id && <span className="you"> (you)</span>}
            </div>
            <div className="meta">
              {u.name && <span>@{u.username} ·</span>}
              <span>{u.solved} solved</span>
              <span>
                · Joined{" "}
                {new Date(u.created).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
          <div className="act">
            <select
              className="fsel"
              aria-label={`Role for ${u.username}`}
              title={u.id === me.id ? "You can't change your own role" : undefined}
              value={u.isAdmin ? "admin" : "member"}
              disabled={u.id === me.id || busyId === u.id}
              onChange={(e) => setRole(u, e.target.value === "admin")}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
