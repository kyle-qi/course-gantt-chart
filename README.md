# Course Timeline

A macOS desktop app for viewing course deliverables on a timeline and editing them with persistent storage between launches.

---

## Install the app (macOS)

### Requirements

1. **macOS** 11 or later  
2. **[Node.js](https://nodejs.org/)** 18 or newer (includes `npm`)  
   - Check: `node -v`  
   - If missing, install the **LTS** build from [nodejs.org](https://nodejs.org/) and reopen Terminal.

### Build steps

```bash
cd "/path/to/course-planner"
npm install
npm run dist
```

When the build finishes, open `dist/`:

| Output | Notes |
|--------|--------|
| `Course Timeline-1.0.0-arm64.dmg` | Apple Silicon installer (name may include `-arm64` on M-series Macs) |
| `Course Timeline-1.0.0-arm64-mac.zip` | Zipped app |
| `mac-arm64/Course Timeline.app` | Run directly without installing |

If macOS blocks the app: **System Settings → Privacy & Security → Open Anyway**, or right-click the app → **Open**.

### Where data is stored

Edits save automatically to:

```text
~/Library/Application Support/course-timeline/deliverables.json
```

Export JSON when you want a backup or to move data to another Mac.

---

## Development

```bash
npm install   # once per machine
npm start     # Electron desktop window
```

`npm start` unsets `ELECTRON_RUN_AS_NODE` so the app runs correctly when launched from tooling that sets that variable.

Other scripts:

| Script | Purpose |
|--------|---------|
| `npm run pack` | Unpacked `.app` in `dist/` (faster than a full DMG build) |
| `npm run dist` | DMG + ZIP for distribution |

---

## Browser mode (optional)

`./run.sh` starts the **desktop app** when dependencies are installed. If Electron is not available, it falls back to a local HTTP server (default port **8765**); data is stored in the browser only.

```bash
./run.sh
# or: PORT=9000 ./run.sh
```

Use the desktop app for disk persistence.

---

## Using the app

- **Courses** — toggle course pills to show or hide courses on the timeline.  
- **Color by** — course or deliverable type.  
- **Zoom** — timeline day width (saved with your data).  
- **Deliverables** — edit the table; changes save automatically.  
- **Export / Import JSON or CSV** — full backup (JSON) or Excel-friendly sheet (CSV).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `command not found: npm` | Install Node.js from [nodejs.org](https://nodejs.org/) |
| `npm run dist` fails | Run `npm install` in the project folder |
| App won’t open (security) | Right-click → **Open**, or allow in **Privacy & Security** |
| Timeline empty | Select at least one course; rows need an **End** date |
| `app.whenReady` error from `npm start` | Run from Terminal in the project folder; avoid `ELECTRON_RUN_AS_NODE=1` |
| Lost edits in browser mode | Use the desktop app; browser storage is separate |

---

## Data format

Persisted JSON (desktop and browser):

```json
{
  "deliverables": [
    {
      "id": "…",
      "course": "ECE457A",
      "type": "Assignment",
      "task": "HW1",
      "startDate": "2026-01-10",
      "endDate": "2026-01-20",
      "weight": 5
    }
  ],
  "selectedCourses": ["ECE457A", "ECE481"],
  "timelineDayWidth": 20
}
```

CSV import/export uses columns: **Course**, **Type**, **Task**, **Start**, **End**, **Weight** (header aliases like `Due Date` are accepted).

Sample data: `data/seed.json` (array of deliverable rows).
