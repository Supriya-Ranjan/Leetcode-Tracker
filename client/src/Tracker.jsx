import { useEffect, useState } from "react";
import { api } from "./api.js";
import { DIFFS, DS, PAT } from "./constants.js";
import Avatar from "./Avatar.jsx";
import Members from "./Members.jsx";
import ProblemForm from "./ProblemForm.jsx";
import Profile from "./Profile.jsx";

const FILTERS = ["All", "Pending", "Done", ...DIFFS];

export default function Tracker({ user, onLogout, onUserChange }) {
  const [problems, setProblems] = useState(null);
  const [prog, setProg] = useState({ done: {}, notes: {} });
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [filter, setFilter] = useState("All");
  const [fds, setFds] = useState("");
  const [fpat, setFpat] = useState("");
  const [openNote, setOpenNote] = useState(null);
  const [view, setView] = useState("problems");

  useEffect(() => {
    Promise.all([api.problems(), api.progress()])
      .then(([p, g]) => {
        setProblems(p);
        setProg(g);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  async function toggleDone(p, checked) {
    try {
      const r = await api.setProgress(p.id, { done: checked });
      setProg((g) => {
        const done = { ...g.done };
        if (r.done) done[p.id] = r.done;
        else delete done[p.id];
        return { ...g, done };
      });
      setOpenNote(checked ? p.id : openNote === p.id ? null : openNote);
      setSaveError("");
    } catch (e) {
      setSaveError(e.message);
    }
  }

  async function saveNote(p, text) {
    const v = text.trim();
    if (v === (prog.notes[p.id] || "")) return;
    try {
      await api.setProgress(p.id, { note: v });
      setProg((g) => {
        const notes = { ...g.notes };
        if (v) notes[p.id] = v;
        else delete notes[p.id];
        return { ...g, notes };
      });
      setSaveError("");
    } catch (e) {
      setSaveError(e.message);
    }
  }

  // ---- admin: add / edit ----
  const [editing, setEditing] = useState(null);

  function startEdit(p) {
    setEditing(p);
    setView("add");
  }

  function stopEdit() {
    setEditing(null);
    setView("problems");
  }

  async function saveProblem(form) {
    if (editing) {
      const saved = await api.updateProblem(editing.id, form);
      setProblems((ps) => ps.map((x) => (x.id === saved.id ? saved : x)));
      stopEdit();
    } else {
      const saved = await api.addProblem(form);
      setProblems((ps) => [...(ps || []), saved]);
    }
  }

  function openTab(k) {
    if (k !== "add") setEditing(null);
    setView(k);
  }

  async function remove(p) {
    if (!confirm("Delete this problem for everyone?")) return;
    try {
      await api.deleteProblem(p.id);
      setProblems((ps) => ps.filter((x) => x.id !== p.id));
    } catch (e) {
      setSaveError(e.message);
    }
  }

  // ---- derived ----
  const all = problems || [];
  const doneN = all.filter((p) => prog.done[p.id]).length;
  const pct = all.length ? Math.round((doneN / all.length) * 100) : 0;
  const shown = all.filter((p) => {
    if (fds && !p.ds.includes(fds)) return false;
    if (fpat && !p.pat.includes(fpat)) return false;
    if (filter === "Pending") return !prog.done[p.id];
    if (filter === "Done") return !!prog.done[p.id];
    if (DIFFS.includes(filter)) return p.diff === filter;
    return true;
  });

  let listBody;
  if (loadError) listBody = <div className="empty">Could not load problems. {loadError}</div>;
  else if (!problems) listBody = <div className="empty">Loading…</div>;
  else if (!shown.length)
    listBody = (
      <div className="empty">
        {all.length
          ? "No problems match this filter."
          : user.isAdmin
            ? "No problems yet. Add the first one from the Add problem tab."
            : "No problems yet. The admin will add them soon."}
      </div>
    );
  else
    listBody = shown.map((p) => (
      <Row
        key={p.id}
        p={p}
        done={prog.done[p.id]}
        note={prog.notes[p.id] || ""}
        noteOpen={openNote === p.id}
        isAdmin={user.isAdmin}
        onToggle={(c) => toggleDone(p, c)}
        onNoteToggle={() => setOpenNote(openNote === p.id ? null : p.id)}
        onNoteSave={(t) => saveNote(p, t)}
        onEdit={() => startEdit(p)}
        onDelete={() => remove(p)}
      />
    ));

  return (
    <div className="wrap">
      <header>
        <h1>LeetCode Tracker</h1>
        <div className="user">
          <button className="me" onClick={() => openTab("profile")} title="Your profile">
            <Avatar user={user} size={28} />
            <b>{user.name || user.username}</b>
          </button>
          {user.isAdmin && <span className="badge">ADMIN</span>}{" "}
          <button className="link" onClick={onLogout}>
            Sign out
          </button>
          {saveError && (
            <>
              <br />
              <span className="err">{saveError}</span>
            </>
          )}
        </div>
      </header>

      {!user.email && view !== "profile" && (
        <div className="banner">
          Add your email so you can reset your password if you forget it.{" "}
          <button className="link" onClick={() => openTab("profile")}>
            Add email
          </button>
        </div>
      )}

      <div className="tabs">
        {[
          ["problems", "Problems"],
          ...(user.isAdmin
            ? [
                ["add", editing ? "Edit problem" : "Add problem"],
                ["members", "Members"],
              ]
            : []),
          ["profile", "Profile"],
        ].map(([k, label]) => (
          <button key={k} className={"tab" + (view === k ? " on" : "")} onClick={() => openTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {view === "profile" ? (
        <Profile onUserChange={onUserChange} />
      ) : view === "members" && user.isAdmin ? (
        <Members me={user} />
      ) : view === "add" && user.isAdmin ? (
        <ProblemForm
          key={editing?.id ?? "new"}
          initial={editing}
          problems={problems || []}
          onSubmit={saveProblem}
          onCancel={stopEdit}
        />
      ) : (
        <>
          <div className="card">
            <div className="prog">
              <span>
                {doneN} of {all.length} solved
              </span>
              <span>{pct}%</span>
            </div>
            <div className="bar">
              <i style={{ width: pct + "%" }} />
            </div>
            <div className="stats">
              {DIFFS.map((d) => {
                const t = all.filter((p) => p.diff === d);
                return (
                  <span key={d}>
                    <b className={d}>{d}</b> {t.filter((p) => prog.done[p.id]).length}/{t.length}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="filters">
            {FILTERS.map((f) => (
              <button key={f} className={"chip" + (f === filter ? " on" : "")} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
            <select className="fsel" value={fds} onChange={(e) => setFds(e.target.value)}>
              <option value="">All data structures</option>
              {DS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select className="fsel" value={fpat} onChange={(e) => setFpat(e.target.value)}>
              <option value="">All patterns</option>
              {PAT.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <div className="card">{listBody}</div>
        </>
      )}
    </div>
  );
}

function Row({ p, done, note, noteOpen, isAdmin, onToggle, onNoteToggle, onNoteSave, onEdit, onDelete }) {
  return (
    <div className={"row" + (done ? " done" : "")}>
      <input type="checkbox" checked={!!done} onChange={(e) => onToggle(e.target.checked)} aria-label="Mark done" />
      <div className="info">
        <div className="t">
          {p.num ? p.num + ". " : ""}
          <a href={p.url} target="_blank" rel="noopener">
            {p.title}
          </a>
        </div>
        <div className="meta">
          <span className={p.diff}>{p.diff}</span>
          {p.ds.length > 0 && <span>· {p.ds.join(", ")}</span>}
          {p.pat.length > 0 && <span>· {p.pat.join(", ")}</span>}
          {done?.on && <span>· Solved {done.on}</span>}
        </div>
        {noteOpen ? (
          <textarea
            className="nta"
            autoFocus
            defaultValue={note}
            placeholder="Approach, complexity, mistakes, things to revisit…"
            onBlur={(e) => onNoteSave(e.target.value)}
          />
        ) : (
          note && <div className="nt">{note}</div>
        )}
      </div>
      <div className="act">
        <a className="go" href={p.url} target="_blank" rel="noopener">
          Solve ↗
        </a>
        <button onClick={onNoteToggle}>{note ? "Note ✎" : "Note"}</button>
        {isAdmin && (
          <>
            <button onClick={onEdit}>Edit</button>
            <button onClick={onDelete}>Delete</button>
          </>
        )}
      </div>
    </div>
  );
}
