import { useState } from "react";
import { DIFFS, DS, PAT } from "./constants.js";

export const EMPTY_FORM = { title: "", num: "", diff: "Medium", ds: "", pat: "", url: "" };

// Add or edit a problem. `initial` is the problem being edited, or null to add a new one.
// `onSubmit(form)` should save it and throw on failure.
export default function ProblemForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(
    initial
      ? {
          title: initial.title,
          num: initial.num || "",
          diff: initial.diff,
          ds: initial.ds,
          pat: initial.pat,
          url: initial.url,
        }
      : EMPTY_FORM,
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim() || !/^https?:\/\//i.test(form.url.trim())) {
      setNote("A title and a valid http(s) problem link are required.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(form);
      if (!initial) {
        setNote(`Added “${form.title.trim()}”.`);
        setForm(EMPTY_FORM);
      }
    } catch (err) {
      setNote(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>{initial ? "Edit problem" : "Add a problem"}</h2>
      <form onSubmit={submit}>
        <input
          className="full"
          autoFocus
          placeholder="Problem title (e.g. Two Sum)"
          value={form.title}
          onChange={set("title")}
          required
        />
        <input type="number" min="1" placeholder="LeetCode #" value={form.num} onChange={set("num")} />
        <select value={form.diff} onChange={set("diff")}>
          {DIFFS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select value={form.ds} onChange={set("ds")}>
          <option value="">Data structure</option>
          {DS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select value={form.pat} onChange={set("pat")}>
          <option value="">Pattern</option>
          {PAT.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          className="full"
          type="url"
          placeholder="Problem link (e.g. https://leetcode.com/problems/two-sum)"
          value={form.url}
          onChange={set("url")}
          required
        />
        <button className="pri full" type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Add problem"}
        </button>
        {initial && (
          <button type="button" className="link full" onClick={onCancel}>
            Cancel edit
          </button>
        )}
      </form>
      {note && <div className="note">{note}</div>}
    </div>
  );
}
