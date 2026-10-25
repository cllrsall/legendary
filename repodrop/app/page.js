"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API = "https://api.github.com";
const MAX = 50 * 1048576;
const SECRET_RE =
  /(^|\/)(\.env(?!\.example$)|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials\.json|service-account.*\.json|.*\.(pem|p12|pfx|key))$/i;
const MUSIC_URL =
  "https://www.image2url.com/r2/default/files/1792913959715-195db757-b7c5-4d96-a67e-fdec64e2c97f.mp3";

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n) =>
  n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";
const seg = (p) => p.split("/").map(encodeURIComponent).join("/");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normalizePath = (path) =>
  String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();

function inspectFile(path, file) {
  const p = normalizePath(path);
  if (
    !p ||
    p.startsWith("/") ||
    /^[a-z]:\//i.test(p) ||
    p.split("/").some((part) => part === ".." || part === "")
  )
    return { path: p || String(path || "(tanpa nama)"), level: "fail", message: "Path tidak aman / tidak valid" };
  if (p.length > 240) return { path: p, level: "fail", message: "Path terlalu panjang (maks. 240 karakter)" };
  if (file.size > MAX) return { path: p, level: "fail", message: "Ukuran melebihi batas aman 50 MB" };
  if (SECRET_RE.test(p)) return { path: p, level: "warn", message: "Nama file berpotensi berisi rahasia/token" };
  return { path: p, level: "pass", message: "Lolos pemeriksaan awal" };
}

function IconGitHub() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}
function IconNext() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.572 0c-.176 0-.339.034-.488.1L.752 5.2A1.07 1.07 0 000 6.158v11.684c0 .382.2.736.528.958l10.332 5.1c.15.066.312.1.488.1s.339-.034.488-.1l10.332-5.1c.328-.222.528-.576.528-.958V6.158a1.07 1.07 0 00-.528-.958L12.06.1a1.07 1.07 0 00-.488-.1zm.097 1.3l9.06 4.47-3.97 1.96-9.06-4.47 3.97-1.96zm-9.66 5.07l9.06 4.47v8.94l-9.06-4.47V6.37zm10.16 13.41v-8.94l9.06-4.47v8.94l-9.06 4.47z" />
    </svg>
  );
}
function IconReact() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />
    </svg>
  );
}

export default function Home() {
  const [page, setPage] = useState("upload");
  const [theme, setTheme] = useState("dark");
  const [muted, setMuted] = useState(false);
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(false);
  const [user, setUser] = useState(null);
  const [repos, setRepos] = useState([]);
  const [repoIdx, setRepoIdx] = useState(0);
  const [branch, setBranch] = useState("");
  const [dir, setDir] = useState("");
  const [nrepo, setNrepo] = useState("");
  const [priv, setPriv] = useState(false);
  const [files, setFiles] = useState(() => new Map());
  const [msg, setMsg] = useState("Upload via RepoDrop");
  const [busy, setBusy] = useState(false);
  const [note1, setNote1] = useState({ t: "", c: "" });
  const [note2, setNote2] = useState({ t: "", c: "" });
  const [note3, setNote3] = useState({ t: "", c: "" });
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [showBar, setShowBar] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [preview, setPreview] = useState(null);
  const [dropOver, setDropOver] = useState(false);
  const musicRef = useRef(null);
  const musicStarted = useRef(false);
  const fiRef = useRef(null);
  const diRef = useRef(null);
  const navLensRef = useRef(null);

  const loggedIn = !!user;

  const toast = useCallback((text, type = "info", ms = 2800) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  // Theme
  useEffect(() => {
    try {
      const t = localStorage.getItem("rd_theme") || "dark";
      setTheme(t);
      document.documentElement.setAttribute("data-theme", t);
    } catch {}
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("rd_theme", next);
    } catch {}
  };

  // Music
  useEffect(() => {
    try {
      setMuted(localStorage.getItem("rd_muted") === "1");
    } catch {}
  }, []);
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    music.volume = 0.32;
    music.muted = muted;
    const start = async () => {
      if (musicStarted.current) return;
      try {
        await music.play();
        musicStarted.current = true;
        ["pointerdown", "touchstart", "click", "keydown"].forEach((e) =>
          document.removeEventListener(e, start, true)
        );
      } catch {}
    };
    ["pointerdown", "touchstart", "click", "keydown"].forEach((e) =>
      document.addEventListener(e, start, { capture: true, passive: true })
    );
    return () =>
      ["pointerdown", "touchstart", "click", "keydown"].forEach((e) =>
        document.removeEventListener(e, start, true)
      );
  }, [muted]);
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (musicRef.current) musicRef.current.muted = next;
    try {
      localStorage.setItem("rd_muted", next ? "1" : "0");
    } catch {}
    if (!next && musicRef.current?.paused && musicStarted.current) {
      musicRef.current.play().catch(() => {});
    }
  };

  // Glass pointer highlight
  useEffect(() => {
    const handler = (e) => {
      const card = e.currentTarget;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    const cards = document.querySelectorAll(".glass");
    cards.forEach((c) => c.addEventListener("pointermove", handler, { passive: true }));
    return () => cards.forEach((c) => c.removeEventListener("pointermove", handler));
  }, [page, loggedIn]);

  // Nav lens
  useEffect(() => {
    const idx = page === "upload" ? 0 : page === "repo" ? 1 : 2;
    if (navLensRef.current) {
      navLensRef.current.style.setProperty("--nav-x", `calc(${idx * 100}% + ${idx * 3}px)`);
    }
  }, [page]);

  // Auto login
  useEffect(() => {
    try {
      const t = localStorage.getItem("rd_token");
      if (t) {
        setToken(t);
        setRemember(true);
        doLogin(t);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function gh(path, opts = {}, tries = 3) {
    for (let i = 0; i < tries; i++) {
      const r = await fetch(API + path, {
        ...opts,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(opts.body ? { "Content-Type": "application/json" } : {}),
        },
      });
      if (r.ok) return r.status === 204 ? null : r.json();
      if ([429, 502, 503].includes(r.status) && i < tries - 1) {
        await sleep(1500 * (i + 1));
        continue;
      }
      let m = "";
      try {
        m = (await r.json()).message;
      } catch {}
      const e = new Error(m || r.statusText);
      e.status = r.status;
      throw e;
    }
  }

  async function doLogin(tok) {
    const t = (tok ?? token).trim();
    if (!t) {
      setNote1({ t: "Isi token dulu.", c: "bad" });
      return;
    }
    setNote1({ t: "Memeriksa token…", c: "" });
    try {
      // temporary set for gh
      const prev = token;
      // use local token for this call
      const me = await (async () => {
        for (let i = 0; i < 3; i++) {
          const r = await fetch(API + "/user", {
            headers: {
              Authorization: "Bearer " + t,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          });
          if (r.ok) return r.json();
          if ([429, 502, 503].includes(r.status) && i < 2) {
            await sleep(1500 * (i + 1));
            continue;
          }
          let m = "";
          try {
            m = (await r.json()).message;
          } catch {}
          const e = new Error(m || r.statusText);
          e.status = r.status;
          throw e;
        }
      })();
      setToken(t);
      setUser(me);
      try {
        remember || tok
          ? localStorage.setItem("rd_token", t)
          : localStorage.removeItem("rd_token");
        if (remember) localStorage.setItem("rd_token", t);
        else if (!tok) {
          /* handled below */
        }
      } catch {}
      if (remember) {
        try {
          localStorage.setItem("rd_token", t);
        } catch {}
      }
      setNote1({ t: "", c: "" });
      toast("Berhasil masuk sebagai @" + me.login, "ok");
      await loadRepos(t);
    } catch (e) {
      setToken("");
      setUser(null);
      const msg =
        e.status === 401 ? "Token tidak valid atau sudah kedaluwarsa." : "Gagal masuk: " + e.message;
      setNote1({ t: msg, c: "bad" });
      toast(msg, "bad");
    }
  }

  async function loadRepos(tokOverride) {
    setLoadingRepos(true);
    setNote2({ t: "Memuat repository…", c: "" });
    const t = tokOverride || token;
    const list = [];
    try {
      for (let p = 1; p <= 10; p++) {
        const r = await fetch(
          API +
            `/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member&page=${p}`,
          {
            headers: {
              Authorization: "Bearer " + t,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );
        if (!r.ok) throw new Error("Gagal memuat repo");
        const data = await r.json();
        list.push(...data);
        if (data.length < 100) break;
      }
      setRepos(list);
      let idx = 0;
      try {
        const last = localStorage.getItem("rd_last_repo");
        if (last) {
          const found = list.findIndex((x) => x.full_name === last);
          if (found >= 0) idx = found;
        }
      } catch {}
      setRepoIdx(idx);
      if (list[idx]) setBranch(list[idx].default_branch || "main");
      setNote2({ t: list.length ? "" : "Belum ada repo. Buat satu di bawah.", c: "" });
    } catch (e) {
      setNote2({ t: e.message, c: "bad" });
    } finally {
      setLoadingRepos(false);
    }
  }

  useEffect(() => {
    const r = repos[repoIdx];
    if (r) {
      setBranch(r.default_branch || "main");
      try {
        localStorage.setItem("rd_last_repo", r.full_name);
      } catch {}
    }
  }, [repoIdx, repos]);

  async function createRepo() {
    const name = nrepo.trim();
    if (!name) {
      setNote2({ t: "Isi nama repo baru.", c: "bad" });
      return;
    }
    try {
      const r = await gh("/user/repos", {
        method: "POST",
        body: JSON.stringify({ name, private: priv, auto_init: true }),
      });
      setRepos((prev) => [r, ...prev]);
      setRepoIdx(0);
      setNrepo("");
      setNote2({ t: "Repo " + r.full_name + " dibuat.", c: "ok" });
      toast("Repo " + r.full_name + " berhasil dibuat", "ok");
    } catch (e) {
      setNote2({ t: "Gagal membuat repo: " + e.message, c: "bad" });
      toast("Gagal membuat repo", "bad");
    }
  }

  function addFiles(list) {
    setFiles((prev) => {
      const next = new Map(prev);
      let skipped = 0;
      let duplicates = 0;
      for (const entry of list) {
        const file = entry.file;
        if (!file) continue;
        const path = normalizePath(entry.path || file.name);
        if (/(^|\/)(\.DS_Store|Thumbs\.db)$/.test(path) || /(^|\/)\.git\//.test(path)) {
          skipped++;
          continue;
        }
        if (next.has(path)) duplicates++;
        next.set(path, file);
      }
      if (skipped) setNote3({ t: `${skipped} file sistem dilewati (mis. .DS_Store / .git).`, c: "" });
      else if (duplicates)
        setNote3({
          t: `${duplicates} path duplikat terdeteksi; file terakhir menggantikan yang sebelumnya.`,
          c: "",
        });
      else setNote3({ t: "", c: "" });
      return next;
    });
  }

  const fileEntries = [...files.entries()];
  const totalSize = fileEntries.reduce((s, [, f]) => s + f.size, 0);
  const errors = fileEntries.filter(([p, f]) => inspectFile(p, f).level === "fail").length;
  const warnings = fileEntries.filter(([p, f]) => inspectFile(p, f).level === "warn").length;
  const goDisabled = !fileEntries.length || busy || errors > 0;

  async function walk(en, base) {
    if (en.isFile)
      return new Promise((res) => en.file((f) => res([{ path: base + en.name, file: f }]), () => res([])));
    const rd = en.createReader();
    let all = [],
      b;
    do {
      b = await new Promise((r) => rd.readEntries(r, () => r([])));
      all.push(...b);
    } while (b.length);
    return (await Promise.all(all.map((e) => walk(e, base + en.name + "/")))).flat();
  }

  const b64 = (f) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(f);
    });

  async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(
      Array.from({ length: n }, async () => {
        while (i < items.length) await fn(items[i++]);
      })
    );
  }

  async function upload() {
    const r = repos[repoIdx];
    if (busy || !r || !files.size) return;
    const checks = [...files].map(([p, f]) => inspectFile(p, f));
    const failed = checks.filter((x) => x.level === "fail");
    const warns = checks.filter((x) => x.level === "warn");
    if (failed.length) {
      setNote3({
        t: `${failed.length} file belum lolos pemeriksaan. Hapus atau perbaiki file berstatus Gagal sebelum upload.`,
        c: "bad",
      });
      return;
    }
    if (
      warns.length &&
      !confirm(
        `${warns.length} file berpotensi berisi kredensial/secret. Jangan upload token, password, private key, atau .env asli ke repository. Tetap lanjutkan?`
      )
    )
      return;
    setBusy(true);
    setLogs([]);
    setShowBar(true);
    setProgress(2);
    setNote3({ t: "", c: "" });
    try {
      const o = r.owner.login,
        n = r.name,
        br = branch.trim() || r.default_branch;
      const pre = normalizePath(dir).replace(/^\/+|\/+$/g, "");
      if (pre && (pre.split("/").some((part) => part === ".." || part === "") || /^[a-z]:/i.test(pre)))
        throw new Error("Folder tujuan tidak valid. Hindari path absolut atau segmen ..");
      const message = msg.trim() || "Upload via RepoDrop";
      const base = `/repos/${o}/${n}`;
      let items = [...files].map(([p, f]) => ({ path: (pre ? pre + "/" : "") + p, file: f }));
      const destinationPaths = items.map((x) => x.path);
      if (new Set(destinationPaths).size !== destinationPaths.length)
        throw new Error("Ada path tujuan duplikat. Periksa kembali folder tujuan dan file.");
      const total = items.length;
      let head,
        lastUrl = `https://github.com/${o}/${n}`;
      try {
        head = await gh(`${base}/git/ref/heads/${seg(br)}`);
      } catch (e) {
        if (e.status === 409) {
          setLogs((l) => [...l, { text: "Repo masih kosong, membuat commit awal…", cls: "" }]);
          const first = items.shift();
          const c = await gh(`${base}/contents/${seg(first.path)}`, {
            method: "PUT",
            body: JSON.stringify({ message, content: await b64(first.file), branch: br }),
          });
          lastUrl = c.commit.html_url;
          setLogs((l) => [...l, { text: first.path, cls: "log-row", ok: true, idx: "1/1" }]);
          if (!items.length) {
            finish(lastUrl, total);
            return;
          }
          head = await gh(`${base}/git/ref/heads/${seg(br)}`);
        } else if (e.status === 404) throw new Error(`Branch "${br}" tidak ditemukan di ${r.full_name}.`);
        else throw e;
      }
      const parent = head.object.sha;
      const pc = await gh(`${base}/git/commits/${parent}`);
      const tree = [];
      let done = 0;
      const totalItems = items.length || 1;
      await pool(items, 2, async (it) => {
        const b = await gh(`${base}/git/blobs`, {
          method: "POST",
          body: JSON.stringify({ content: await b64(it.file), encoding: "base64" }),
        });
        tree.push({ path: it.path, mode: "100644", type: "blob", sha: b.sha });
        done++;
        setProgress(Math.round((done / totalItems) * 90));
        setLogs((l) => [...l, { text: it.path, cls: "log-row", ok: true, idx: `${done}/${totalItems}` }]);
      });
      setLogs((l) => [...l, { text: "Membuat commit…", cls: "" }]);
      const t = await gh(`${base}/git/trees`, {
        method: "POST",
        body: JSON.stringify({ base_tree: pc.tree.sha, tree }),
      });
      const c = await gh(`${base}/git/commits`, {
        method: "POST",
        body: JSON.stringify({ message, tree: t.sha, parents: [parent] }),
      });
      await gh(`${base}/git/refs/heads/${seg(br)}`, {
        method: "PATCH",
        body: JSON.stringify({ sha: c.sha }),
      });
      finish(c.html_url, total);
    } catch (e) {
      setNote3({ t: e.message, c: "bad" });
      setProgress(0);
      toast(e.message || "Upload gagal", "bad", 4000);
      setBusy(false);
    }
  }

  function finish(url, n) {
    setProgress(100);
    setNote3({
      t: `${n} file berhasil diupload. <a href="${esc(url)}" target="_blank" rel="noopener">Lihat commit</a>`,
      c: "ok",
    });
    toast(`${n} file berhasil diupload`, "ok", 3500);
    setFiles(new Map());
    setBusy(false);
  }

  function logout() {
    if (
      files.size &&
      !confirm("Masih ada file di daftar upload. Yakin ingin keluar? File belum diupload akan hilang.")
    )
      return;
    setToken("");
    setUser(null);
    setRepos([]);
    setFiles(new Map());
    try {
      localStorage.removeItem("rd_token");
    } catch {}
    toast("Berhasil keluar", "info");
  }

  const currentRepo = repos[repoIdx];

  return (
    <>
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <i
              className={`fa-solid ${
                t.type === "ok" ? "fa-circle-check" : t.type === "bad" ? "fa-circle-xmark" : "fa-circle-info"
              }`}
            />
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      <main>
        <header>
          <div className="hero-title">
            <div>
              <h1>RepoDrop</h1>
              <p>Upload file dan folder langsung ke repository GitHub kamu. Tanpa git, tanpa terminal.</p>
            </div>
            <div className="hero-actions">
              <button type="button" className="mute-btn" onClick={toggleMute} title="Mute / unmute musik">
                <i className={`fa-solid ${muted ? "fa-volume-xmark" : "fa-volume-high"}`} />
              </button>
              <button type="button" className="theme-btn" onClick={toggleTheme} title="Ganti tema">
                <i className={`fa-solid ${theme === "dark" ? "fa-moon" : "fa-sun"}`} />
              </button>
              <div className="tech-brands">
                <a
                  className="tech-brand"
                  href="https://github.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="GitHub"
                >
                  <IconGitHub />
                  <span className="label">GitHub</span>
                </a>
                <a
                  className="tech-brand"
                  href="https://nextjs.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Next.js"
                >
                  <IconNext />
                  <span className="label">Next.js</span>
                </a>
                <a
                  className="tech-brand"
                  href="https://react.dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="React"
                >
                  <IconReact />
                  <span className="label">React</span>
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Upload */}
        <div className={`page ${page === "upload" ? "active" : ""}`}>
          <section className="glass">
            <div className={`empty-gate ${!loggedIn ? "show" : ""}`}>
              <div className="eg-icon">
                <i className="fa-solid fa-lock" />
              </div>
              <strong>Belum masuk</strong>
              <p>Masuk dulu dengan Personal Access Token di halaman Setting biar bisa upload file.</p>
              <button type="button" onClick={() => setPage("setting")}>
                Buka Setting
              </button>
            </div>
            <div className={`page-content ${!loggedIn ? "hidden" : ""}`}>
              <h2>Upload file &amp; folder</h2>
              <div
                className={`drop ${dropOver ? "over" : ""}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDropOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDropOver(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDropOver(false);
                  const ents = [...e.dataTransfer.items]
                    .map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry())
                    .filter(Boolean);
                  if (ents.length) addFiles((await Promise.all(ents.map((en) => walk(en, "")))).flat());
                  else addFiles([...e.dataTransfer.files].map((f) => ({ path: f.name, file: f })));
                }}
              >
                <strong>Tarik file atau folder ke sini</strong>
                <small>Struktur folder ikut terupload</small>
                <div className="row">
                  <button type="button" className="ghost" onClick={() => fiRef.current?.click()}>
                    Pilih file
                  </button>
                  <button type="button" className="ghost" onClick={() => diRef.current?.click()}>
                    Pilih folder
                  </button>
                </div>
              </div>
              <input
                ref={fiRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  addFiles([...e.target.files].map((f) => ({ path: f.name, file: f })));
                  e.target.value = "";
                }}
              />
              <input
                ref={diRef}
                type="file"
                webkitdirectory=""
                hidden
                onChange={(e) => {
                  addFiles(
                    [...e.target.files].map((f) => ({ path: f.webkitRelativePath || f.name, file: f }))
                  );
                  e.target.value = "";
                }}
              />
              <div className="sum">
                <span>{fileEntries.length ? `${fileEntries.length} file · ${fmt(totalSize)}` : "Belum ada file"}</span>
                {fileEntries.length > 0 && (
                  <button type="button" className="ghost" style={{ padding: "4px 12px" }} onClick={() => setFiles(new Map())}>
                    Kosongkan
                  </button>
                )}
              </div>
              {fileEntries.length > 0 && (
                <div className="list">
                  {fileEntries.slice(0, 300).map(([p, f]) => {
                    const v = inspectFile(p, f);
                    const previewable =
                      f.size <= 1024 * 1024 &&
                      /\.(txt|md|json|js|jsx|ts|tsx|css|html|xml|yml|yaml|toml|csv|svg|py|java|kt|dart|sh|sql|env\.example)$/i.test(
                        p
                      );
                    return (
                      <div className="item" key={p}>
                        <span title={p}>{p}</span>
                        <em>{fmt(f.size)}</em>
                        <span className={`file-state ${v.level}`} title={v.message}>
                          {v.level === "pass" ? "Lolos" : v.level === "warn" ? "Cek" : "Gagal"}
                        </span>
                        <div className="file-actions">
                          {previewable && (
                            <button
                              type="button"
                              className="preview-btn"
                              onClick={async () => {
                                try {
                                  const text = await f.text();
                                  setPreview({
                                    path: p,
                                    size: fmt(f.size),
                                    content:
                                      text.slice(0, 20000) +
                                      (text.length > 20000
                                        ? "\n\n… preview dipotong pada 20.000 karakter."
                                        : ""),
                                  });
                                } catch {
                                  setPreview({ path: p, size: fmt(f.size), content: "Preview tidak tersedia." });
                                }
                              }}
                            >
                              Preview
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setFiles((prev) => {
                                const n = new Map(prev);
                                n.delete(p);
                                return n;
                              })
                            }
                            title="Hapus file"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {fileEntries.length > 300 && (
                    <div className="item">
                      <em>+{fileEntries.length - 300} file lainnya</em>
                    </div>
                  )}
                </div>
              )}
              <div className="preflight">
                <div className="preflight-head">
                  <strong>
                    <i className="fa-solid fa-shield-halved" /> Pemeriksaan file
                  </strong>
                  <small>
                    {fileEntries.length
                      ? `${fileEntries.length} file diperiksa · ${fmt(totalSize)}`
                      : "Pilih file untuk mulai memeriksa."}
                  </small>
                </div>
                <div className="preflight-stats">
                  {fileEntries.length ? (
                    <>
                      <span className="pill pass">
                        <i className="fa-solid fa-check" /> {fileEntries.length - errors - warnings} lolos
                      </span>
                      <span className="pill warn">
                        <i className="fa-solid fa-triangle-exclamation" /> {warnings} peringatan
                      </span>
                      <span className="pill fail">
                        <i className="fa-solid fa-xmark" /> {errors} masalah
                      </span>
                    </>
                  ) : (
                    <span className="pill">Validasi otomatis aktif</span>
                  )}
                </div>
              </div>
              {preview && (
                <div className="preview-panel show">
                  <div className="preflight-head">
                    <strong>{preview.path}</strong>
                    <button type="button" className="ghost" style={{ padding: "5px 10px" }} onClick={() => setPreview(null)}>
                      Tutup
                    </button>
                  </div>
                  <small>
                    {preview.size} · preview lokal, tidak mengubah file
                  </small>
                  <pre>{preview.content}</pre>
                </div>
              )}
              <label htmlFor="msg">Pesan commit</label>
              <input id="msg" type="text" value={msg} onChange={(e) => setMsg(e.target.value)} />
              <div className="row" style={{ marginTop: 16 }}>
                <button type="button" disabled={goDisabled} onClick={upload}>
                  Upload ke GitHub
                </button>
              </div>
              <div className="bar" style={{ display: showBar ? "block" : "none" }}>
                <i style={{ width: progress + "%" }} />
              </div>
              <div id="log">
                {logs.map((l, i) =>
                  l.cls === "log-row" ? (
                    <div key={i} className="log-row">
                      <span className="log-ok">✓</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{l.text}</span>
                      <em style={{ color: "var(--mute)" }}>{l.idx}</em>
                    </div>
                  ) : (
                    <div key={i}>{l.text}</div>
                  )
                )}
              </div>
              <div className={`note ${note3.c}`} dangerouslySetInnerHTML={{ __html: note3.t }} />
            </div>
          </section>
        </div>

        {/* Repository */}
        <div className={`page ${page === "repo" ? "active" : ""}`}>
          <section className="glass">
            <div className={`empty-gate ${!loggedIn ? "show" : ""}`}>
              <div className="eg-icon">
                <i className="fa-solid fa-folder-lock" />
              </div>
              <strong>Belum masuk</strong>
              <p>Masuk dulu di halaman Setting supaya daftar repository kamu bisa dimuat.</p>
              <button type="button" onClick={() => setPage("setting")}>
                Buka Setting
              </button>
            </div>
            <div className={`page-content ${!loggedIn ? "hidden" : ""}`}>
              <h2>Pilih repository</h2>
              <label htmlFor="repo">Repository</label>
              <select
                id="repo"
                value={repoIdx}
                onChange={(e) => setRepoIdx(Number(e.target.value))}
                style={{ display: loadingRepos ? "none" : undefined }}
              >
                {repos.map((r, i) => (
                  <option key={r.full_name} value={i}>
                    {r.full_name}
                    {r.private ? " 🔒" : ""}
                  </option>
                ))}
              </select>
              <div className={`skel-wrap ${loadingRepos ? "show" : ""}`}>
                <div className="skel h36" />
                <div className="skel w80" />
                <div className="skel w60" />
                <div className="skel w40" />
              </div>
              <div className="row">
                <div>
                  <label htmlFor="branch">Branch</label>
                  <input id="branch" type="text" placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="dir">Folder tujuan (opsional)</label>
                  <input id="dir" type="text" placeholder="contoh: assets/img" value={dir} onChange={(e) => setDir(e.target.value)} />
                </div>
              </div>
              <label htmlFor="nrepo">Atau buat repo baru</label>
              <div className="row">
                <input
                  id="nrepo"
                  type="text"
                  placeholder="nama-repo-baru"
                  style={{ flex: 2 }}
                  value={nrepo}
                  onChange={(e) => setNrepo(e.target.value)}
                />
                <button type="button" className="ghost" style={{ flex: 1 }} onClick={createRepo}>
                  Buat
                </button>
              </div>
              <div className="chk">
                <input type="checkbox" id="priv" checked={priv} onChange={(e) => setPriv(e.target.checked)} />
                <label htmlFor="priv" style={{ margin: 0 }}>
                  Jadikan private
                </label>
              </div>
              <div className={`note ${note2.c}`}>{note2.t}</div>
              <div className="repo-meta">
                {currentRepo && (
                  <>
                    <a href={currentRepo.html_url} target="_blank" rel="noopener noreferrer">
                      <i className="fa-brands fa-github" /> Buka repository
                    </a>
                    <span className="pill">{currentRepo.private ? "Private" : "Public"}</span>
                    <span className="pill">
                      <i className="fa-solid fa-star" /> {Number(currentRepo.stargazers_count || 0)} stars
                    </span>
                    <span className="pill">
                      <i className="fa-solid fa-code-branch" /> {Number(currentRepo.forks_count || 0)} forks
                    </span>
                    <span className="pill">Branch: {currentRepo.default_branch || "—"}</span>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Setting */}
        <div className={`page ${page === "setting" ? "active" : ""}`}>
          <section className="glass">
            <h2>Pengaturan token</h2>
            <label htmlFor="tok">Personal access token</label>
            <input
              id="tok"
              type="password"
              placeholder="ghp_… atau github_pat_…"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doLogin()}
            />
            <div className="chk">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="remember" style={{ margin: 0 }}>
                Ingat token di perangkat ini
              </label>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <button type="button" onClick={() => doLogin()}>
                Masuk
              </button>
            </div>
            <p className="hint">
              Buat token di{" "}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=RepoDrop"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>{" "}
              dengan izin <b>repo</b> (atau Contents: read &amp; write untuk fine-grained). Token hanya dikirim
              ke api.github.com.
            </p>
            <div className={`note ${note1.c}`}>{note1.t}</div>
            {user && (
              <div className="me">
                <img src={user.avatar_url} alt="" />
                <div style={{ flex: 1 }}>
                  <b>{user.name || user.login}</b>
                  <small>@{user.login}</small>
                </div>
                <button type="button" className="ghost" onClick={logout}>
                  Keluar
                </button>
              </div>
            )}
            <div className="about-block">
              <h2 style={{ marginBottom: 10 }}>Tentang RepoDrop</h2>
              <p>
                RepoDrop memudahkan kamu mengunggah file dan folder langsung ke repository GitHub tanpa perlu
                menginstall git atau membuka terminal. Semua diubah menjadi satu commit yang rapi.
              </p>
              <p>
                Dibangun dengan <b>Next.js</b> &amp; <b>React</b>. Cukup masuk dengan Personal Access Token,
                pilih repo (atau buat baru), tarik file/folder, lalu upload.
              </p>
            </div>
            <div className="dev-card">
              <img src="https://i.imgur.com/GT4z6Jm.jpeg" alt="SALL DEC7TY" width={72} height={72} />
              <div className="dev-name">Developed: SALL DEC7TY</div>
              <div className="dev-label">RepoDrop · Next.js · React · liquid glass</div>
            </div>
          </section>
        </div>
      </main>

      <audio ref={musicRef} src={MUSIC_URL} preload="auto" loop playsInline />

      <nav className="rd-nav" aria-label="Navigasi RepoDrop">
        <span className="rd-nav-lens" ref={navLensRef} aria-hidden="true" />
        <button
          type="button"
          className={page === "upload" ? "active" : ""}
          onClick={() => setPage("upload")}
          title="Upload"
        >
          <i className="fa-solid fa-cloud-arrow-up" />
          <span>Upload</span>
        </button>
        <button
          type="button"
          className={page === "repo" ? "active" : ""}
          onClick={() => setPage("repo")}
          title="Repository"
        >
          <i className="fa-solid fa-folder-tree" />
          <span>Repository</span>
        </button>
        <button
          type="button"
          className={page === "setting" ? "active" : ""}
          onClick={() => setPage("setting")}
          title="Setting"
        >
          <i className="fa-solid fa-gear" />
          <span>Setting</span>
        </button>
      </nav>
    </>
  );
}
