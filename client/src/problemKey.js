// Same problem → same key, however the link was copied: LeetCode links reduce to
// their slug, so /problems/two-sum, /problems/two-sum/description/ and
// ?envType=... variants all match. Keep in sync with problemKey() in server/src/index.js.
export function problemKey(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const slug = /^\/problems\/([^/]+)/i.exec(u.pathname)?.[1];
    if (/(^|\.)leetcode\.(com|cn)$/.test(host) && slug) return "leetcode/" + slug.toLowerCase();
    return host + u.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

// The existing problem that `form` would duplicate (same number or link), if any.
export function findDuplicate(form, problems, exceptId = null) {
  const num = parseInt(form.num, 10) || null;
  const key = /^https?:\/\/\S+\.\S+/i.test(form.url.trim()) ? problemKey(form.url.trim()) : null;
  for (const p of problems) {
    if (p.id === exceptId) continue;
    if (num && p.num === num) return { problem: p, why: `number ${num}` };
    if (key && problemKey(p.url) === key) return { problem: p, why: "link" };
  }
  return null;
}
