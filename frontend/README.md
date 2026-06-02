# ArthaSync — Next.js Edition

Unified Commerce Intelligence for Indian Retail SMEs.  
Migrated from CRA (react-scripts) → **Next.js 15 App Router + TypeScript + Tailwind CSS**.

---

## Why Next.js (vs the old react-scripts setup)

| | Old CRA | This repo |
|---|---|---|
| Node version lock | react-scripts 5 breaks on Node 18+ | Works on **Node 18, 20, 22, 24** |
| Routing | react-router-dom (client bundle) | Next.js file-system routing (zero config) |
| Deployment | Manual build + static host | One-click **Vercel** (`vercel --prod`) |
| Performance | All JS in one bundle | Automatic code-splitting per route |
| API routes | Separate backend needed | Built-in `/app/api/` route handlers |
| TypeScript | Optional, manual | First-class, strict by default |

---

## ✅ Recommended Node Version

```
node -v → v20.x LTS  (or 18 / 22 / 24 — all work)
```

Use **nvm** to switch:
```bash
nvm install 20
nvm use 20
```

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Add your Gemini API key
#    Edit .env.local and paste your key:
NEXT_PUBLIC_GEMINI_API_KEY=your_key_here

# 3. Run dev server
npm run dev
# → http://localhost:3000

# 4. Production build
npm run build
npm start
```

---

## Project structure

```
arthasync-next/
├── app/
│   ├── layout.tsx          # Root HTML shell (fonts, metadata)
│   ├── globals.css         # All ArthaSync CSS (animations, tokens)
│   ├── page.tsx            # / → Landing page
│   └── dashboard/
│       └── page.tsx        # /dashboard → Chat UI
├── components/
│   ├── Sidebar.tsx         # Session list, language, sandbox toggle
│   ├── ChatInput.tsx       # Textarea + send/voice buttons
│   ├── MessageBubble.tsx   # User & AI message rendering (react-markdown)
│   ├── TypingIndicator.tsx # Animated dots while AI responds
│   └── WelcomeCards.tsx    # Stats grid + suggestion chips
├── context/
│   └── ChatContext.tsx     # Global state: sessions, language, sandbox
├── lib/
│   └── geminiService.ts    # Gemini 2.0 Flash client + sandbox fallback
└── .env.local              # NEXT_PUBLIC_GEMINI_API_KEY
```

---

## Deploy to Vercel (one command)

```bash
npm install -g vercel
vercel --prod
```

Add `NEXT_PUBLIC_GEMINI_API_KEY` in the Vercel dashboard under **Settings → Environment Variables**.

---

## Sandbox Mode

Toggle **Sandbox Mode** in the sidebar to use pre-written mock responses — no API key required. Useful for demos and offline testing.

---

## Stack

- **Next.js 15** (App Router, Turbopack)
- **TypeScript** strict mode
- **Tailwind CSS v4**
- **@google/generative-ai** (Gemini 2.0 Flash)
- **react-markdown** for AI response rendering
- **Syne + DM Mono** (Google Fonts)
- **Tabler Icons** webfont

---

Team ArthaSync · GHRCEM Pune · Cognizant Technoverse Hackathon 2026
