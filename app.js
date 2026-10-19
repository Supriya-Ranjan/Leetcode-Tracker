(function () {
  var problems = [],
    prog = { done: {}, notes: {} },
    filter = "All",
    editId = null,
    openNote = null;
  var isAdmin = false,
    db = null,
    pref = null,
    timer = null,
    canSave = false,
    fds = "",
    fpat = "";
  var DS = [
    "Array",
    "String",
    "Hash Table",
    "Linked List",
    "Stack",
    "Queue",
    "Heap / Priority Queue",
    "Tree",
    "Binary Search Tree",
    "Trie",
    "Graph",
    "Matrix",
    "Set",
  ];
  var PAT = [
    "Two Pointers",
    "Sliding Window",
    "Fast & Slow Pointers",
    "Binary Search",
    "Prefix Sum",
    "Merge Intervals",
    "Cyclic Sort",
    "Monotonic Stack",
    "Backtracking",
    "Recursion",
    "DFS",
    "BFS",
    "Topological Sort",
    "Union Find",
    "Dynamic Programming",
    "Greedy",
    "Divide & Conquer",
    "Sorting",
    "Top K Elements",
    "Bit Manipulation",
  ];
  function opts(list, ph, sel) {
    return (
      '<option value="">' +
      ph +
      "</option>" +
      list
        .map(function (x) {
          return (
            "<option" +
            (x === sel ? " selected" : "") +
            ">" +
            esc(x) +
            "</option>"
          );
        })
        .join("")
    );
  }
  function selHtml(k, ph, list, sel) {
    return (
      '<select class="fsel" data-k="' +
      k +
      '">' +
      opts(list, "All " + ph.toLowerCase(), sel) +
      "</select>"
    );
  }
  var $ = function (id) {
    return document.getElementById(id);
  };
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML.replace(/"/g, "&quot;");
  }

  function saveProg() {
    if (!canSave) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      pref.set(prog).catch(function () {
        $("user").innerHTML +=
          "<br>Could not save progress. Ask the admin to share this page as Contributor.";
      });
    }, 250);
  }

  function render() {
    var all = problems,
      doneN = all.filter(function (p) {
        return prog.done[p.id];
      }).length;
    var pct = all.length ? Math.round((doneN / all.length) * 100) : 0;
    $("pt").textContent = doneN + " of " + all.length + " solved";
    $("pp").textContent = pct + "%";
    $("pb").style.width = pct + "%";
    var st = "";
    ["Easy", "Medium", "Hard"].forEach(function (d) {
      var t = all.filter(function (p) {
          return p.diff === d;
        }),
        x = t.filter(function (p) {
          return prog.done[p.id];
        }).length;
      st +=
        '<span><b class="' +
        d +
        '">' +
        d +
        "</b> " +
        x +
        "/" +
        t.length +
        "</span>";
    });
    $("stats").innerHTML = st;
    $("filters").innerHTML =
      ["All", "Pending", "Done", "Easy", "Medium", "Hard"]
        .map(function (f) {
          return (
            '<button class="chip' +
            (f === filter ? " on" : "") +
            '" data-f="' +
            f +
            '">' +
            f +
            "</button>"
          );
        })
        .join("") +
      selHtml("ds", "Data structure", DS, fds) +
      selHtml("pat", "Pattern", PAT, fpat);
    var shown = all.filter(function (p) {
      if (fds && p.ds !== fds) return false;
      if (fpat && p.pat !== fpat) return false;
      if (filter === "Pending") return !prog.done[p.id];
      if (filter === "Done") return !!prog.done[p.id];
      if (["Easy", "Medium", "Hard"].indexOf(filter) > -1)
        return p.diff === filter;
      return true;
    });
    if (!shown.length) {
      $("list").innerHTML =
        '<div class="empty">' +
        (all.length
          ? "No problems match this filter."
          : isAdmin
            ? "No problems yet. Add the first one below."
            : "No problems yet. The admin will add them soon.") +
        "</div>";
      return;
    }
    $("list").innerHTML = shown
      .map(function (p) {
        var d = prog.done[p.id],
          note = prog.notes[p.id] || "",
          title = esc(p.title);
        return (
          '<div class="row' +
          (d ? " done" : "") +
          '" data-id="' +
          p.id +
          '">' +
          '<input type="checkbox" ' +
          (d ? "checked" : "") +
          (canSave ? "" : " disabled") +
          ' aria-label="Mark done">' +
          '<div class="info"><div class="t">' +
          (p.num ? p.num + ". " : "") +
          '<a href="' +
          esc(p.url) +
          '" target="_blank" rel="noopener">' +
          title +
          "</a></div>" +
          '<div class="meta"><span class="' +
          p.diff +
          '">' +
          p.diff +
          "</span>" +
          (p.ds ? "<span>· " + esc(p.ds) + "</span>" : "") +
          (p.pat ? "<span>· " + esc(p.pat) + "</span>" : "") +
          (p.topic ? "<span>· " + esc(p.topic) + "</span>" : "") +
          (d && d.on ? "<span>· Solved " + esc(d.on) + "</span>" : "") +
          "</div>" +
          (openNote === p.id
            ? '<textarea class="nta" placeholder="Approach, complexity, mistakes, things to revisit…">' +
              esc(note) +
              "</textarea>"
            : note
              ? '<div class="nt">' + esc(note) + "</div>"
              : "") +
          "</div>" +
          '<div class="act"><a class="go" href="' +
          esc(p.url) +
          '" target="_blank" rel="noopener">Solve ↗</a>' +
          (canSave
            ? '<button data-a="note">' +
              (note ? "Note ✎" : "Note") +
              "</button>"
            : "") +
          (isAdmin
            ? '<button data-a="edit">Edit</button><button data-a="del">Delete</button>'
            : "") +
          "</div></div>"
        );
      })
      .join("");
  }

  $("filters").addEventListener("click", function (e) {
    var f = e.target.getAttribute("data-f");
    if (f) {
      filter = f;
      render();
    }
  });

  $("list").addEventListener("click", function (e) {
    var row = e.target.closest(".row");
    if (!row) return;
    var id = row.getAttribute("data-id"),
      p = problems.filter(function (x) {
        return x.id === id;
      })[0];
    if (!p) return;
    if (e.target.type === "checkbox") {
      if (e.target.checked) {
        prog.done[id] = {
          on: new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        };
        openNote = id;
      } else {
        delete prog.done[id];
        if (openNote === id) openNote = null;
      }
      saveProg();
      render();
      var t0 = document.querySelector(".nta");
      if (t0 && prog.done[id]) t0.focus();
      return;
    }
    var a = e.target.getAttribute("data-a");
    if (a === "note") {
      openNote = openNote === id ? null : id;
      render();
      var t1 = document.querySelector(".nta");
      if (t1) t1.focus();
    }
    if (a === "del" && isAdmin) {
      if (confirm("Delete this problem for everyone?"))
        db.collection("problems").doc(id).delete();
    }
    if (a === "edit" && isAdmin) {
      editId = id;
      $("title").value = p.title;
      $("num").value = p.num || "";
      $("diff").value = p.diff;
      $("ds").value = p.ds || "";
      $("pat").value = p.pat || "";
      $("url").value = p.url || "";
      $("fh").textContent = "Edit problem (admin)";
      $("sb").textContent = "Save changes";
      $("admin").scrollIntoView({ behavior: "smooth" });
      $("title").focus();
    }
  });

  $("list").addEventListener("focusout", function (e) {
    if (!e.target.classList || !e.target.classList.contains("nta"))
      return;
    var row = e.target.closest(".row");
    if (!row) return;
    var id = row.getAttribute("data-id"),
      v = e.target.value.trim();
    if (v) prog.notes[id] = v;
    else delete prog.notes[id];
    saveProg();
  });

  $("f").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!isAdmin) return;
    var data = {
      title: $("title").value.trim(),
      num: parseInt($("num").value, 10) || null,
      diff: $("diff").value,
      ds: $("ds").value,
      pat: $("pat").value,
      url: $("url").value.trim(),
    };
    if (!data.title || !/^https?:\/\//i.test(data.url)) {
      $("note").textContent =
        "A title and a valid http(s) problem link are required.";
      return;
    }
    var col = db.collection("problems"),
      p;
    if (editId) {
      p = col.doc(editId).update(data);
      editId = null;
      $("fh").textContent = "Add a problem (admin)";
      $("sb").textContent = "Add problem";
    } else {
      data.created = Date.now();
      p = col.add(data);
    }
    p.then(function () {
      $("note").textContent = "";
    }).catch(function () {
      $("note").textContent =
        "Could not save. Only admins can change problems.";
    });
    $("f").reset();
    $("diff").value = "Medium";
  });

  $("ds").innerHTML = opts(DS, "Data structure", "");
  $("pat").innerHTML = opts(PAT, "Pattern", "");
  $("filters").addEventListener("change", function (e) {
    var k = e.target.getAttribute("data-k");
    if (!k) return;
    if (k === "ds") fds = e.target.value;
    else fpat = e.target.value;
    render();
  });

  // Minimal stand-in for the claude.ai db, backed by localStorage, so the
  // tracker works when index.html is opened directly from disk.
  function localDb() {
    var KEY = "lc-tracker",
      subs = {};
    function load() {
      try {
        return JSON.parse(localStorage.getItem(KEY)) || {};
      } catch (e) {
        return {};
      }
    }
    function store(all, path) {
      try {
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch (e) {}
      (subs[path] || []).forEach(function (cb) {
        cb(snapOf(path));
      });
    }
    function snapOf(path) {
      var c = load()[path] || {};
      return {
        docs: Object.keys(c).map(function (k) {
          return {
            id: k,
            data: function () {
              return Object.assign({}, c[k]);
            },
          };
        }),
      };
    }
    function write(path, id, fn) {
      var all = load();
      all[path] = all[path] || {};
      fn(all[path], id);
      store(all, path);
      return Promise.resolve();
    }
    return {
      collection: function (path) {
        return {
          doc: function (id) {
            return {
              get: function () {
                var d = (load()[path] || {})[id];
                return Promise.resolve({
                  exists: !!d,
                  data: function () {
                    return d;
                  },
                });
              },
              set: function (v) {
                return write(path, id, function (c) {
                  c[id] = v;
                });
              },
              update: function (v) {
                return write(path, id, function (c) {
                  c[id] = Object.assign({}, c[id], v);
                });
              },
              delete: function () {
                return write(path, id, function (c) {
                  delete c[id];
                });
              },
            };
          },
          add: function (v) {
            var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            return write(path, id, function (c) {
              c[id] = v;
            });
          },
          onSnapshot: function (cb) {
            (subs[path] = subs[path] || []).push(cb);
            cb(snapOf(path));
          },
        };
      },
    };
  }

  async function init() {
    var user = null;
    try {
      if (window.claude && claude.use) {
        user = await claude.use("user");
        db = await claude.use("db");
      }
    } catch (e) {}
    var id = null,
      name = "";
    try {
      if (user) {
        id = await user.id();
        var me = await user.me();
        name = (me && me.name) || "";
        isAdmin = !!(await user.canEdit());
      }
    } catch (e) {}
    if (!window.claude) {
      db = localDb();
      id = "local";
      name = "local mode";
      isAdmin = true;
    }
    if (!db || !id) {
      $("user").textContent =
        "Please sign in to claude.ai to use the tracker";
      $("list").innerHTML =
        '<div class="empty">Sign in to see the problem list and save your progress.</div>';
      return;
    }
    $("user").innerHTML =
      "Signed in" +
      (name ? " as <b>" + esc(name) + "</b>" : "") +
      (isAdmin ? '<span class="badge">ADMIN</span>' : "");
    if (isAdmin) $("admin").classList.remove("hide");
    pref = db.collection("data/users/" + id).doc("progress");
    try {
      var s = await pref.get();
      if (s.exists) {
        var d = s.data() || {};
        prog = { done: d.done || {}, notes: d.notes || {} };
      }
    } catch (e) {}
    canSave = true;
    db.collection("problems").onSnapshot(
      function (snap) {
        problems = snap.docs
          .map(function (x) {
            var d = x.data();
            d.id = x.id;
            return d;
          })
          .sort(function (a, b) {
            return (a.created || 0) - (b.created || 0);
          });
        render();
      },
      function () {
        $("list").innerHTML =
          '<div class="empty">Could not load problems.</div>';
      },
    );
  }
  init();
})();
