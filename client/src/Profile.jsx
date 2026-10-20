import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import Avatar from "./Avatar.jsx";
import PasswordInput from "./PasswordInput.jsx";

const LINKS = [
  ["github", "GitHub", "github.com/username"],
  ["linkedin", "LinkedIn", "linkedin.com/in/username"],
  ["leetcode", "LeetCode", "leetcode.com/u/username"],
  ["twitter", "X / Twitter", "x.com/username"],
  ["website", "Website", "yourname.dev"],
];
const BIO_MAX = 500;
const AVATAR_PX = 256;

// Center-crop an image file to a square and shrink it to a small JPEG data URL.
async function toAvatar(file) {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_PX;
  canvas
    .getContext("2d")
    .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  img.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function Profile({ onUserChange }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .profile()
      .then((p) => {
        setForm(p);
        setSaved(p);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  if (!form)
    return (
      <div className="card">
        <div className="empty">{loadError || "Loading…"}</div>
      </div>
    );

  return (
    <>
      <ProfileDetails
        form={form}
        setForm={setForm}
        saved={saved}
        onSaved={(p) => {
          setForm(p);
          setSaved(p);
          onUserChange({
            id: p.id,
            username: p.username,
            isAdmin: p.isAdmin,
            name: p.name,
            avatar: p.avatar,
            email: p.email,
          });
        }}
      />
      <ChangeEmail
        current={saved.email}
        onChanged={(p) => {
          // Only the email changed; keep any unsaved edits in the profile form.
          setForm((f) => ({ ...f, email: p.email }));
          setSaved((s) => ({ ...s, email: p.email }));
          onUserChange({
            id: p.id,
            username: p.username,
            isAdmin: p.isAdmin,
            name: p.name,
            avatar: p.avatar,
            email: p.email,
          });
        }}
      />
      <ChangePassword username={form.username} />
    </>
  );
}

// Changing (or adding) the email needs a 6-digit code sent to the new address.
function ChangeEmail({ current, onChanged }) {
  const [step, setStep] = useState("idle"); // idle → enter → code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [note, setNote] = useState({ text: "", ok: false });
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep("idle");
    setEmail("");
    setCode("");
    setNote({ text: "" });
  }

  async function sendCode(e) {
    e?.preventDefault();
    setBusy(true);
    setNote({ text: "" });
    try {
      const r = await api.requestEmailCode(email);
      setSentTo(r.sentTo);
      setCode("");
      setStep("code");
      setNote({
        text: `We sent a 6-digit code to ${r.sentTo}. It expires in ${r.expiresInMinutes} minutes.`,
        ok: true,
      });
    } catch (err) {
      setNote({ text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setNote({ text: "" });
    try {
      onChanged(await api.verifyEmailCode(code));
      setStep("idle");
      setEmail("");
      setCode("");
      setNote({ text: "Email updated.", ok: true });
    } catch (err) {
      setNote({ text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Email</h2>
      {step === "idle" && (
        <div className="email-row">
          <div>
            {current ? <b>{current}</b> : <span className="muted-em">No email yet</span>}
            <div className="note">Used to reset your password if you forget it.</div>
          </div>
          <button type="button" className="link" onClick={() => setStep("enter")}>
            {current ? "Change" : "Add email"}
          </button>
        </div>
      )}

      {step === "enter" && (
        <form onSubmit={sendCode} className="profile">
          <label className="full">
            <span>New email</span>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              placeholder="you@example.com"
              required
            />
          </label>
          <button className="pri" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </button>
          <button type="button" className="link muted" onClick={reset}>
            Cancel
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="profile">
          <label className="full">
            <span>Code sent to {sentTo}</span>
            <input
              className="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              pattern="\d{6}"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </label>
          <button className="pri" type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : "Verify"}
          </button>
          <div className="otp-actions">
            <button type="button" className="link" disabled={busy} onClick={sendCode}>
              Resend code
            </button>
            <button type="button" className="link muted" onClick={() => setStep("enter")}>
              Use a different email
            </button>
            <button type="button" className="link muted" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {note.text && <div className={"note" + (note.ok ? "" : " err")}>{note.text}</div>}
    </div>
  );
}

function ProfileDetails({ form, setForm, saved, onSaved }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setLink = (k) => (e) => setForm({ ...form, links: { ...form.links, [k]: e.target.value } });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setNote("Please choose an image file.");
    if (file.size > 15 * 1024 * 1024) return setNote("That image is over 15 MB. Please choose a smaller one.");
    try {
      setForm({ ...form, avatar: await toAvatar(file) });
      setNote("");
    } catch {
      setNote("Couldn't read that image. Try a JPEG or PNG.");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(await api.saveProfile(form));
      setNote("Profile saved.");
    } catch (err) {
      setNote(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Profile</h2>
      <form onSubmit={submit} className="profile">
        <div className="full photo">
          <Avatar user={form} size={72} />
          <div>
            <div className="t">{form.name || form.username}</div>
            <div className="meta">
              <span>@{form.username}</span>
              <span>
                · Joined {new Date(form.created).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
              </span>
            </div>
            <div className="photo-btns">
              <button type="button" className="link" onClick={() => fileRef.current.click()}>
                {form.avatar ? "Change photo" : "Upload photo"}
              </button>
              {form.avatar && (
                <button type="button" className="link muted" onClick={() => setForm({ ...form, avatar: null })}>
                  Remove
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          </div>
        </div>

        <label className="full">
          <span>Name</span>
          <input value={form.name} onChange={set("name")} maxLength={60} placeholder="Your full name" />
        </label>
        <label>
          <span>Education</span>
          <input
            value={form.education}
            onChange={set("education")}
            maxLength={120}
            placeholder="e.g. B.Tech CSE, IIT Delhi"
          />
        </label>
        <label>
          <span>Location</span>
          <input value={form.location} onChange={set("location")} maxLength={60} placeholder="e.g. Bengaluru" />
        </label>
        <label className="full">
          <span>
            Bio{" "}
            <em>
              {form.bio.length}/{BIO_MAX}
            </em>
          </span>
          <textarea
            value={form.bio}
            onChange={set("bio")}
            maxLength={BIO_MAX}
            placeholder="A line or two about you, what you're preparing for, your goals…"
          />
        </label>

        <h3 className="full">Links</h3>
        {LINKS.map(([k, label, ph]) => (
          <label key={k}>
            <span>{label}</span>
            <input value={form.links[k] || ""} onChange={setLink(k)} placeholder={ph} inputMode="url" />
          </label>
        ))}

        <button className="pri full" type="submit" disabled={busy || !dirty}>
          {busy ? "Saving…" : dirty ? "Save profile" : "Saved"}
        </button>
      </form>
      {note && <div className={"note" + (note === "Profile saved." ? "" : " err")}>{note}</div>}
    </div>
  );
}

function ChangePassword({ username }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState({ text: "", ok: false });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (next.length < 6) return setNote({ text: "New password must be at least 6 characters." });
    if (next !== confirm) return setNote({ text: "The new passwords don't match." });
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setNote({ text: "Password changed. You've been signed out on your other devices.", ok: true });
    } catch (err) {
      setNote({ text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Change password</h2>
      <form onSubmit={submit} className="profile">
        {/* Lets password managers know which account this is for. */}
        <input type="text" autoComplete="username" value={username} readOnly hidden />
        <label className="full">
          <span>Current password</span>
          <PasswordInput
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label>
          <span>New password</span>
          <PasswordInput
            autoComplete="new-password"
            minLength={6}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </label>
        <label>
          <span>Confirm new password</span>
          <PasswordInput
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        <button className="pri full" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
      {note.text && <div className={"note" + (note.ok ? "" : " err")}>{note.text}</div>}
    </div>
  );
}
