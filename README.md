# 🧠 DevMemory
> **The Living AI Project Brain & Visualizer for Solo Developers** • *100% Free & Local*

DevMemory connects to your local project folders (like `projects by me`), auto-detects their tech stack, tracks where you left off, visualizes their system architecture with interactive diagrams, and provides smart AI next actions—all with **zero server costs** and **complete privacy**.

---

## ✨ Features

- **📂 Auto-Project Discovery:** Point DevMemory to any directory on your computer; it instantly detects your frameworks (React, Vite, Express, Next.js, Python, Flask, HTML5, etc.).
- **🧭 "Where You Left Off" Radar:** Scans recent file edits and git commits to tell you exactly where you stopped working and what was changed.
- **🗺️ Interactive Architecture Visualizer:** Automatically generates visual component & API flow charts powered by Mermaid.js.
- **⚡ Health & Config Checker:** Alerts you if dependencies are missing (`needs npm i`), `.env` files are missing, or if you have unsaved git changes.
- **🤖 AI Next Steps Engine:** Generates a 3-bullet project state assessment and recommended next tasks (works 100% offline with zero keys, or with an optional free Google Gemini API key).
- **📇 One-Click Portfolio / Showcase Card:** Creates exportable Markdown and HTML snippets to showcase your projects on your resume or GitHub profile.
- **💻 One-Click Launchers:** Open any project directly in VS Code or Windows File Explorer with one click.
- **🎙️ AudioSnap Integration (Upcoming):** Voice-powered screen bug reporter module.

---

## 🚀 How to Run

### Method 1: One-Click (Windows)
Double-click `start.bat` in the `DevMemory` folder! It opens your browser to `http://localhost:5005`.

### Method 2: Command Line
```bash
cd DevMemory/server
npm start
```
Then visit: [http://localhost:5005](http://localhost:5005)

---

## 🛠️ Tech Stack (₹0 Cost)
- **Backend:** Node.js + Express
- **Frontend:** HTML5, Tailwind CSS, Lucide Icons, Mermaid.js
- **Storage:** Local JSON (`devmemory-db.json`)
- **AI Engine:** Offline Smart Heuristic Engine + Google Gemini API Free Tier
