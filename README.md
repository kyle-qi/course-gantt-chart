# Course Timeline

A macOS desktop app for viewing course deliverables on a timeline and editing them with persistent storage between launches.

---

## Install the app (macOS)

### What you need first

1. **macOS** 11 or later  
2. **[Node.js](https://nodejs.org/)** 18 or newer (includes `npm`)  
   - Check: open Terminal and run `node -v`  
   - If missing, download the **LTS** installer from [nodejs.org](https://nodejs.org/) and run it, then quit and reopen Terminal.

### Step 1 — Open the project folder in Terminal

```bash
cd "/path/to/course-planner"
```

Use the real path where you cloned or saved this repo (e.g. `~/Documents/course-planner`).

### Step 2 — Install dependencies (once per machine)

```bash
npm install
```

This downloads Electron and build tools. It can take a few minutes the first time.

### Step 3 — Build the macOS app

```bash
npm run dist
```

When it finishes, look in the `dist/` folder:

| Output | What to do |
|--------|------------|
| `Course Timeline-1.0.0.dmg` | Double-click to mount, drag **Course Timeline** into **Applications** |
| `mac-arm64/Course Timeline.app` | Run directly (Apple Silicon) |
| `mac/Course Timeline.app` | Run directly (Intel Mac) |

### Step 4 — Open the app

1. Open **Applications** (or the `.app` in `dist/`).  
2. If macOS says the app is from an unidentified developer:  
   - **System Settings → Privacy & Security** → **Open Anyway**, or  
   - Right-click the app → **Open** → **Open** again.

### Step 5 — Your data

Edits save automatically to:

```text
~/Library/Application Support/course-timeline/deliverables.json
```

You do not need to export manually unless you want a backup.

---

## Run without installing (development)

Useful while changing the project or before building a `.app`:

```bash
npm install   # if you have not already
npm start
```

Opens the same UI in a desktop window (not a browser tab).

---

## Using the app

- **Show courses** — tap course pills to show any combination on the timeline; **Select all** / **Clear** for quick changes.  
- **Color by** — course or deliverable type.  
- **Deliverables** — edit the table at the bottom; changes persist after you quit.  
- **Export / Import JSON** — backup or move data to another Mac.  
- **Reset to seed** — restore the sample courses in `data/seed.json`.

---

## Browser mode (optional)

If Node is not installed, you can use a simple browser version (data stays in the browser only):

```bash
./run.sh
```

Then open the URL shown in Terminal. For persistent disk storage, use the desktop app above.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `command not found: npm` | Install Node.js from [nodejs.org](https://nodejs.org/) |
| `npm run dist` fails | Run `npm install` again; ensure you are in the `course-planner` folder |
| App won’t open (security) | Right-click → **Open**, or allow in **Privacy & Security** |
| Timeline empty | Select at least one course pill; ensure rows have **End** dates |
| Lost edits (browser mode) | Use the desktop app; browser data is separate from the `.app` |

---

## Data format

```json
{
  "deliverables": [ ... ],
  "selectedCourses": ["ECE457A", "ECE481"]
}
```

Seed data: `data/seed.json`
