# Drop Clock

A gentle break reminder clock, available as a web app and Windows desktop app.

## Electron

```sh
npm ci
npm start
npm run dist
```

The installer is generated in `dist/`.

## Tauri (Windows)

Install the stable MSVC Rust toolchain, Visual Studio's **Desktop development
with C++** workload (including the Windows SDK), and the WebView2 Runtime.
Restart your terminal after installing Rust so that `cargo` is on PATH.

```sh
npm ci
npm run tauri:dev
npm run tauri:build
```

The installer is generated in `src-tauri/target/release/bundle/nsis/`.
The standalone application is `src-tauri/target/release/drop-clock-tauri.exe`.
WebView2 is required to run the app; the installer can download it if missing.

The Tauri edition has its own application ID and the name **Drop Clock Tauri**,
so it can be installed alongside the Electron edition.
Both editions use the root `index.html` and the same icons. Tauri copies only
the required web assets into `.tauri-web/` before starting or building.
Restart `tauri:dev` after editing these shared web assets to refresh the copy.

Styles and fonts currently load from the internet. Click the start overlay
to enable the alarm audio. Closing the window exits the application.
