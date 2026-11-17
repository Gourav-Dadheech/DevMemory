import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { scanRootDirectory, scanProject } from './scanner.js';
import { generateMermaidDiagram } from './diagramGenerator.js';
import { generateProjectInsights } from './aiHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

const DB_FILE = path.join(__dirname, 'devmemory-db.json');

// Helper to read DB
function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch {}
  return { notes: {}, pinned: [], apiKey: '', customScanPath: '', recentPaths: [] };
}

// Helper to write DB
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write db:', err);
  }
}

// Default initial projects directory (supports NPX scan path)
const DEFAULT_SCAN_PATH = process.env.DEVMEMORY_SCAN_PATH
  ? path.resolve(process.env.DEVMEMORY_SCAN_PATH)
  : path.resolve(__dirname, '../../..');

// 1. Scan root directory of projects
app.get('/api/scan', async (req, res) => {
  try {
    const isWeb = process.env.VERCEL || (req.headers.host && req.headers.host.includes('vercel.app'));
    if (isWeb) {
      return res.json({ projects: [], scannedPath: '', subfolders: [], recentPaths: [] });
    }
    const db = readDb();
    let targetPath = req.query.path || db.customScanPath || DEFAULT_SCAN_PATH;
    targetPath = path.resolve(targetPath);

    let scanResult;
    try {
      scanResult = await scanRootDirectory(targetPath);
    } catch (scanErr) {
      console.warn(`Could not read ${targetPath}, falling back to current folder:`, scanErr.message);
      targetPath = path.resolve(__dirname, '..');
      scanResult = await scanRootDirectory(targetPath);
    }

    // Save to recent paths
    const recentPaths = Array.from(new Set([targetPath, ...(db.recentPaths || [])])).slice(0, 8);
    db.customScanPath = targetPath;
    db.recentPaths = recentPaths;
    writeDb(db);

    // Attach pinned and user notes
    const enrichedProjects = scanResult.projects.map(p => ({
      ...p,
      isPinned: db.pinned?.includes(p.id) || false,
      userNote: db.notes?.[p.id] || ''
    }));

    res.json({
      ...scanResult,
      projects: enrichedProjects,
      savedApiKey: !!db.apiKey,
      currentScanPath: targetPath,
      defaultScanPath: DEFAULT_SCAN_PATH,
      recentPaths
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Scan single project
app.get('/api/project', async (req, res) => {
  try {
    const { path: projectPath } = req.query;
    if (!projectPath) return res.status(400).json({ error: 'path is required' });

    const project = await scanProject(path.resolve(projectPath));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const db = readDb();
    project.isPinned = db.pinned?.includes(project.id) || false;
    project.userNote = db.notes?.[project.id] || '';

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Generate Architecture Diagram (with direction TD or LR)
app.get('/api/diagram', async (req, res) => {
  try {
    const { path: projectPath, direction = 'TD' } = req.query;
    if (!projectPath) return res.status(400).json({ error: 'path is required' });

    const project = await scanProject(path.resolve(projectPath));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const diagram = generateMermaidDiagram(project, direction);
    res.json({ diagram, projectName: project.name, direction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Generate AI Insights / Next Steps
app.post('/api/insights', async (req, res) => {
  try {
    const { project, customApiKey } = req.body;
    if (!project) return res.status(400).json({ error: 'project is required' });

    const db = readDb();
    const apiKey = customApiKey || db.apiKey || process.env.GEMINI_API_KEY || null;

    const insights = await generateProjectInsights(project, apiKey);
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Open in VS Code
app.post('/api/open-vscode', (req, res) => {
  const { path: projectPath } = req.body;
  if (!projectPath) return res.status(400).json({ error: 'path is required' });

  exec(`code "${path.resolve(projectPath)}"`, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to open VS Code. Ensure "code" CLI is in your PATH.' });
    res.json({ success: true, message: 'Opened in VS Code' });
  });
});

// 6. Open in Explorer
app.post('/api/open-folder', (req, res) => {
  const { path: projectPath } = req.body;
  if (!projectPath) return res.status(400).json({ error: 'path is required' });

  exec(`explorer "${path.resolve(projectPath)}"`, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to open explorer' });
    res.json({ success: true, message: 'Opened folder in Explorer' });
  });
});

// 7. Save Note / Pin / Settings
app.post('/api/settings', (req, res) => {
  try {
    const { projectId, note, isPinned, apiKey, customScanPath } = req.body;
    const db = readDb();

    if (projectId) {
      if (note !== undefined) db.notes[projectId] = note;
      if (isPinned !== undefined) {
        db.pinned = (db.pinned || []).filter(id => id !== projectId);
        if (isPinned) db.pinned.push(projectId);
      }
    }

    if (apiKey !== undefined) db.apiKey = apiKey;
    if (customScanPath !== undefined) db.customScanPath = customScanPath;

    writeDb(db);
    res.json({ success: true, db: { ...db, apiKey: !!db.apiKey } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Download Zip Package
app.get('/api/download-zip', (req, res) => {
  const zipPath = path.join(__dirname, 'public', 'DevMemory.zip');
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'DevMemory.zip');
  } else {
    res.status(404).json({ error: 'Zip not found' });
  }
});

// 9. Official Product / Download Landing Page (for web visitors & root)
app.get(['/', '/download', '/landing'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 10. Local Developer Cockpit Dashboard (for local desktop app)
app.get(['/dashboard', '/app'], (req, res) => {
  const isWeb = process.env.VERCEL || (req.headers.host && req.headers.host.includes('vercel.app'));
  if (isWeb) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 DevMemory is active at: http://localhost:${PORT}`);
  console.log(`📁 Default Scan Directory: ${DEFAULT_SCAN_PATH}`);
  console.log(`======================================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.warn(`\n⚠️ Port ${PORT} was busy. Auto-switching to port ${nextPort}...`);
    app.listen(nextPort, () => {
      console.log(`🚀 DevMemory is active at: http://localhost:${nextPort}\n`);
    });
  } else {
    console.error('Server error:', err);
  }
});
