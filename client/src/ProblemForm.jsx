import { useState } from "react";
import { DIFFS, DS, PAT } from "./constants.js";
import { findDuplicate } from "./problemKey.js";

export const EMPTY_FORM = { title: "", num: "", diff: "Medium", ds: [], pat: [], url: "" };

// Add or edit a problem. `initial` is the problem being edited, or null to add a new one.
// `problems` is the current list, used to warn about duplicates as you type.
// `onSubmit(form)` should save it and throw on failure.
export default function ProblemForm({ initial, problems = [], onSubmit, onCancel }) {
  const [form, setForm] = useState(
    initial
      ? {
          title: initial.title,
          num: initial.num || "",
          diff: initial.diff,
          ds: initial.ds || [],
          pat: initial.pat || [],
          url: initial.url,
        }
      : EMPTY_FORM,
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const dup = findDuplicate(form, problems, initial?.id ?? null);

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim() || !/^https?:\/\//i.test(form.url.trim())) {
      setNote("A title and a valid http(s) problem link are required.");
      return;
    }
    if (dup) return;
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
        <TagPicker label="Data structures" options={DS} value={form.ds} onChange={(ds) => setForm({ ...form, ds })} />
        <TagPicker label="Patterns" options={PAT} value={form.pat} onChange={(pat) => setForm({ ...form, pat })} />
        <input
          className="full"
          type="url"
          placeholder="Problem link (e.g. https://leetcode.com/problems/two-sum)"
          value={form.url}
          onChange={set("url")}
          required
        />
        {dup && (
          <div className="full dup" role="alert">
            Already added (same {dup.why}):{" "}
            <a href={dup.problem.url} target="_blank" rel="noopener">
              {dup.problem.num ? dup.problem.num + ". " : ""}
              {dup.problem.title}
            </a>
          </div>
        )}
        <button className="pri full" type="submit" disabled={busy || !!dup}>
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

// Toggle chips for picking any number of options.
function TagPicker({ label, options, value, onChange }) {
  const toggle = (x) => onChange(value.includes(x) ? value.filter((v) => v !== x) : [...value, x]);
  return (
    <fieldset className="full tagpick">
      <legend>
        {label}
        {value.length > 0 && (
          <>
            {" "}
            <em>{value.length} selected</em>{" "}
            <button type="button" className="link muted" onClick={() => onChange([])}>
              Clear
            </button>
          </>
        )}
      </legend>
      <div className="chips">
        {options.map((x) => {
          const on = value.includes(x);
          return (
            <button
              key={x}
              type="button"
              className={"chip" + (on ? " on" : "")}
              aria-pressed={on}
              onClick={() => toggle(x)}
            >
              {on && "✓ "}
              {x}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
