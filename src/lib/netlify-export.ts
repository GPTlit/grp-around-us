import type { AppConfig, Block, Extension } from "@/lib/blocks";

/** Pure helpers that turn the live app config + AI pages into a static, Netlify-Drop-ready site. */

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function blockHtml(block: Block): string {
  switch (block.type) {
    case "heading": {
      const level = block.level ?? 2;
      return `<h${level}>${esc(block.text)}</h${level}>`;
    }
    case "text":
      return `<p>${esc(block.text)}</p>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>${block.items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
    }
    case "cards":
      return `<div class="grid">${block.items
        .map(
          (c) =>
            `<div class="card"><div class="emoji">${esc(c.emoji ?? "🃏")}</div><h3>${esc(
              c.title,
            )}</h3>${c.body ? `<p>${esc(c.body)}</p>` : ""}</div>`,
        )
        .join("")}</div>`;
    case "stats":
      return `<div class="grid stats">${block.items
        .map(
          (s) =>
            `<div class="card"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`,
        )
        .join("")}</div>`;
    case "callout":
      return `<div class="callout ${esc(block.tone ?? "info")}">${esc(block.text)}</div>`;
    case "quote":
      return `<blockquote>${esc(block.text)}${
        block.author ? `<footer>— ${esc(block.author)}</footer>` : ""
      }</blockquote>`;
    case "sound":
      return `<div class="callout info">🔊 ${esc(block.label ?? block.sound)} (sound plays in the live app)</div>`;
    case "link":
      return `<p><a class="btn" href="${esc(block.to === "/" ? "/" : block.to.replace(/^\//, "/") + "/")}">${esc(
        block.label,
      )}</a></p>`;
    case "code":
      return `<pre><code>${esc(block.code)}</code></pre>`;
    case "divider":
      return `<hr />`;
    default:
      return "";
  }
}

function shell(config: AppConfig, title: string, description: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=Manrope:wght@400;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/styles.css" />
<style>:root{--accent:${esc(config.accent)}}</style>
</head>
<body>
<header class="top">
  <a class="brand" href="/">${esc(config.name)} <span>♠️</span></a>
  <button id="theme" type="button" aria-label="Toggle theme">🌗</button>
</header>
<main class="wrap">${body}</main>
<footer class="foot">${esc(config.name)} · static export · built by the in-app AI Studio</footer>
<script src="/app.js"></script>
</body>
</html>`;
}

const CSS = `*{box-sizing:border-box}
:root{color-scheme:light;--bg:#f8fafc;--surface:#ffffff;--fg:#0f172a;--muted:#64748b;--border:#e2e8f0}
html[data-theme="dark"]{color-scheme:dark;--bg:#0b1120;--surface:#131c31;--fg:#f1f5f9;--muted:#94a3b8;--border:#26304a}
body{margin:0;background:var(--bg);color:var(--fg);font-family:Manrope,system-ui,sans-serif;line-height:1.6}
h1,h2,h3,.brand{font-family:Sora,system-ui,sans-serif;line-height:1.2}
.top{display:flex;align-items:center;justify-content:space-between;max-width:56rem;margin:0 auto;padding:16px}
.brand{font-weight:800;font-size:1.1rem;text-decoration:none;color:var(--fg)}
#theme{border:1px solid var(--border);background:var(--surface);border-radius:12px;padding:6px 10px;cursor:pointer;font-size:1rem}
.wrap{max-width:56rem;margin:0 auto;padding:8px 16px 56px}
.hero{background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:28px;box-shadow:0 12px 30px rgba(15,23,42,.06)}
.hero h1{margin:0;font-size:2rem}
.hero p.lead{color:var(--muted);margin-top:8px}
.pill{display:inline-block;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);border-radius:999px;padding:4px 12px;font-size:.75rem;font-weight:600}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin:16px 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:16px}
.card h3{margin:6px 0 4px;font-size:1rem}
.card p{margin:0;color:var(--muted);font-size:.9rem}
.stats .card{text-align:center}
.stats strong{display:block;font-family:Sora;font-size:1.6rem;color:var(--accent)}
.stats span{color:var(--muted);font-size:.8rem}
.callout{border-radius:16px;padding:12px 16px;margin:12px 0;border:1px solid var(--border);background:var(--surface)}
.callout.warn{border-color:#f59e0b55;background:#f59e0b14}
.callout.win{border-color:#22c55e55;background:#22c55e14}
.callout.lose{border-color:#ef444455;background:#ef444414}
blockquote{margin:16px 0;padding:12px 18px;border-left:4px solid var(--accent);color:var(--muted)}
blockquote footer{margin-top:6px;font-size:.85rem}
pre{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px;overflow:auto;font-size:.82rem}
a.btn,.cta{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;border-radius:16px;padding:12px 18px;margin-top:8px}
.list{display:grid;gap:10px;margin-top:16px}
.list a{display:block;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:14px 16px;text-decoration:none;color:var(--fg);font-weight:600}
hr{border:0;border-top:1px solid var(--border);margin:20px 0}
.foot{max-width:56rem;margin:0 auto;padding:0 16px 40px;color:var(--muted);font-size:.8rem}`;

const JS = `(function(){
  var k='ld-theme';
  var saved=localStorage.getItem(k)||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  document.documentElement.dataset.theme=saved;
  var b=document.getElementById('theme');
  if(b)b.addEventListener('click',function(){
    var next=document.documentElement.dataset.theme==='dark'?'light':'dark';
    document.documentElement.dataset.theme=next;localStorage.setItem(k,next);
  });
})();`;

export type ExportInput = {
  config: AppConfig;
  extensions: Extension[];
  drafts: { title: string; file_path: string; code: string; note: string | null }[];
  liveUrl?: string;
};

/** Returns a map of file path -> file contents, ready to zip and drop on Netlify. */
export function buildNetlifySite({ config, extensions, drafts, liveUrl }: ExportInput) {
  const files: Record<string, string> = {};

  const pageLinks = extensions
    .map(
      (e) =>
        `<a href="/x/${esc(e.slug)}/">${esc(e.icon ?? "📄")} ${esc(e.title)}${
          e.description ? ` — <span style="color:var(--muted);font-weight:400">${esc(e.description)}</span>` : ""
        }</a>`,
    )
    .join("");

  files["index.html"] = shell(
    config,
    `${config.name} — 3-player bluffing card game`,
    config.tagline,
    `<section class="hero">
      <span class="pill">3 players · 32 cards · 3 lies · first to 3</span>
      <h1>${esc(config.name)}</h1>
      <p class="lead">${esc(config.tagline)}</p>
      ${liveUrl ? `<a class="cta" href="${esc(liveUrl)}">Play the live game</a>` : ""}
    </section>
    <div class="grid">
      <div class="card"><div class="emoji">🃏</div><h3>Secret cards</h3><p>The moderator deals one hidden card to each rival from the 32-card deck.</p></div>
      <div class="card"><div class="emoji">🤥</div><h3>Three lies</h3><p>Bluff, mislead or tell the truth — but lie a fourth time and you lose the round.</p></div>
      <div class="card"><div class="emoji">🎙️</div><h3>Voice & memes</h3><p>Voice notes, live calls and meme sounds right in the room.</p></div>
    </div>
    <h2>Features</h2>
    <ul>
      <li>🪙 <strong>Loan</strong> — the moderator privately tells you if that answer was a lie.</li>
      <li>🔁 <strong>Repeat</strong> — force the same question again.</li>
      <li>🛑 <strong>Stop</strong> — call three lies. Right = a point, wrong = your Stop is gone.</li>
    </ul>
    ${extensions.length ? `<h2>Pages</h2><div class="list">${pageLinks}</div>` : ""}`,
  );

  for (const ext of extensions) {
    files[`x/${ext.slug}/index.html`] = shell(
      config,
      `${ext.title} — ${config.name}`,
      ext.description ?? config.tagline,
      `<section class="hero"><span class="pill">${esc(ext.icon ?? "📄")} page</span><h1>${esc(
        ext.title,
      )}</h1>${ext.description ? `<p class="lead">${esc(ext.description)}</p>` : ""}</section>
      <article>${ext.blocks.map(blockHtml).join("\n")}</article>
      <p><a class="btn" href="/">← Back home</a></p>`,
    );
  }

  files["styles.css"] = CSS;
  files["app.js"] = JS;
  files["_redirects"] = "/*  /index.html  200\n";
  files["netlify.toml"] = `[build]\n  publish = "."\n  command = ""\n\n[[headers]]\n  for = "/*"\n  [headers.values]\n    X-Frame-Options = "SAMEORIGIN"\n`;
  files["robots.txt"] = "User-agent: *\nAllow: /\n";
  files["README.txt"] = `${config.name} — static export
Generated ${new Date().toISOString()}

HOW TO DEPLOY (no build step needed)
1. Unzip this folder.
2. Go to https://app.netlify.com/drop
3. Drag the unzipped folder onto the page. That's it — it is live.

WHAT IS INSIDE
- index.html            landing page (name, tagline, rules, feature list)
- x/<slug>/index.html   every page the AI Studio built
- styles.css, app.js    styling with working light/dark toggle
- _redirects, netlify.toml  Netlify config so every URL resolves
- source-drafts/        code the AI Studio wrote for the full React app

The realtime multiplayer game itself needs its backend, so it stays on the live
app URL${liveUrl ? ` (${liveUrl})` : ""}. This export is the shareable public site.
`;

  for (const draft of drafts) {
    const safe = draft.file_path.replace(/^[./]+/, "").replace(/[^a-zA-Z0-9._/$-]/g, "_");
    files[`source-drafts/${safe}`] = `${draft.note ? `// ${draft.note}\n` : ""}${draft.code}\n`;
  }

  return files;
}
