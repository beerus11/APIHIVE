<p align="center">
  <img src="public/icon.png" alt="APIHive" width="128" />
</p>

# APIHive

**Open-source API testing & development platform** — a free, Postman-style desktop app for designing, testing, and debugging APIs. Built with Electron and React.

![APIHive](https://img.shields.io/badge/APIHive-0.1.0-orange)
![Electron](https://img.shields.io/badge/Electron-28-47848f)
![React](https://img.shields.io/badge/React-18-61dafb)
![License](https://img.shields.io/badge/License-AGPL--3.0-blue)

---

## Features

- **Request builder** — All HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS), URL bar, query params, headers, and body (JSON/text)
- **Authentication** — Basic, Bearer token, API Key (header or query)
- **Collections** — Save, load, duplicate, and delete requests; sidebar list with method badges
- **Request history** — Recent runs with status, duration, and size
- **Environment variables** — Use `{{variable}}` in URL, headers, and body; manage in the right sidebar
- **Response viewer** — Status, timing, size, pretty-printed body, and response headers
- **CORS-free** — Requests run in the Electron main process, so no browser CORS limits
- **Local storage** — Collections, variables, and history stored in `localStorage` (no account required)
- **Dark UI** — Postman-inspired theme with orange accents

---

## Tech stack

| Layer        | Tech              |
| ------------ | ----------------- |
| Desktop      | Electron 28       |
| UI           | React 18 + TypeScript |
| Build (UI)   | Vite 5            |
| Preload      | CommonJS (Node)   |

---

## Prerequisites

- **Node.js** 18+ (recommend 20+)
- **npm** 9+

---

## Installation

```bash
git clone <your-repo-url>
cd apihive
npm install
```

---

## Development

Start the app in development mode (Vite dev server + Electron):

```bash
npm run dev
```

- The React app is served at `http://localhost:5173` and loaded by Electron.
- DevTools open automatically.
- Main process TypeScript is compiled to `dist/main/`; preload uses `src/main/preload.cjs`.

---

## Building for production

1. Build the main process, renderer, and copy preload:

   ```bash
   npm run build
   ```

2. Package the app (output in `release/`):

   ```bash
   npm run dist
   ```

   Or unpacked directory only:

   ```bash
   npm run pack
   ```

   Targets: **macOS** (dmg), **Windows** (nsis), **Linux** (AppImage). Configured in `electron-builder.json`.

---

## Project structure

```
apihive/
├── public/                 # Static assets (if any)
├── src/
│   ├── main/               # Electron main process
│   │   ├── main.ts         # Window, IPC, HTTP requests
│   │   ├── preload.cjs     # Preload script (exposes window.api)
│   │   └── preload.ts      # (unused; preload runs as .cjs)
│   ├── renderer/           # React UI
│   │   ├── App.tsx         # Main app (request builder, collections, response)
│   │   ├── main.tsx        # React entry + error boundary
│   │   ├── index.html      # HTML entry
│   │   ├── styles.css      # Global styles
│   │   └── global.d.ts    # window.api types
│   └── shared/             # Shared utilities (if added)
├── dist/                   # Build output (main + renderer)
├── tests/                  # Unit/integration tests (if added)
├── electron-builder.json   # Packager config
├── vite.config.ts          # Vite config (renderer)
├── tsconfig.json           # TS config (renderer)
├── tsconfig.main.json      # TS config (main process)
├── PRD.md                  # Product requirements
└── package.json
```

---

## Usage tips

- **Variables** — In the right sidebar under **Environment**, add key/value pairs. In URL, headers, or body use `{{key}}` to substitute.
- **Save to collection** — Click **Save to Collection** to add the current request to the left sidebar. Click an item to load it; use **Copy** / **Del** to duplicate or remove.
- **Send** — Pick method and URL, set params/headers/body/auth as needed, then click **Send**. Response and timing appear below; the run is added to **History**.

---

## Roadmap

See [PRD.md](./PRD.md) for the full product roadmap. Planned areas:

- Postman collection import (v2.1)
- Pre-request / post-response scripts and assertions
- OpenAPI import and doc generation
- GraphQL, WebSocket, mock server

---

## License

AGPL-3.0 (see [LICENSE](./LICENSE) if present). Commercial licensing options may be available for proprietary use.

---

## Contributing

Contributions are welcome. Please open an issue or PR and follow the project’s code style and PRD goals.
