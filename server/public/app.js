/**
 * DevMemory - Enhanced Client Application Logic
 * Supports: Any Folder Scanning, Subfolder Navigation, Full Zoom & Orientation Architecture Visualizer
 */

// Initialize Mermaid with generous spacing so nodes are never cut off
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true,
    curve: 'basis',
    nodeSpacing: 55,
    rankSpacing: 55,
    padding: 35
  },
  themeVariables: {
    darkMode: true,
    background: '#000000',
    primaryColor: '#ffffff',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#ffffff',
    lineColor: '#71717a',
    secondaryColor: '#27272a',
    tertiaryColor: '#18181b'
  }
});

// App State
let projectsData = [];
let activeFilter = 'all';
let searchQuery = '';
let currentDiagramCode = '';
let currentDiagramPath = '';
let currentDiagramDirection = 'TD';
let currentZoom = 1.0;
let currentInsightsData = null;
let currentProjectForShowcase = null;

// Path & Navigation State
let currentScanPath = '';
let parentScanPath = null;
let defaultScanPath = '';

// DOM Elements
const projectsGrid = document.getElementById('projectsGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const pathInput = document.getElementById('pathInput');
const scanPathBtn = document.getElementById('scanPathBtn');
const goUpBtn = document.getElementById('goUpBtn');
const subfoldersBar = document.getElementById('subfoldersBar');
const subfoldersList = document.getElementById('subfoldersList');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const settingsBtn = document.getElementById('settingsBtn');

// Modals
const diagramModal = document.getElementById('diagramModal');
const aiModal = document.getElementById('aiModal');
const showcaseModal = document.getElementById('showcaseModal');
const settingsModal = document.getElementById('settingsModal');
const shareAppModal = document.getElementById('shareAppModal');
const shareAppBtn = document.getElementById('shareAppBtn');

// Diagram Elements
const mermaidTarget = document.getElementById('mermaidTarget');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
const toggleOrientationBtn = document.getElementById('toggleOrientationBtn');
const orientLabel = document.getElementById('orientLabel');

// 1. FETCH AND RENDER PROJECTS FROM ANY PATH
async function loadProjects(targetPath = '') {
  try {
    loadingState.classList.remove('hidden');
    projectsGrid.innerHTML = '';
    emptyState.classList.add('hidden');

    const url = targetPath ? `/api/scan?path=${encodeURIComponent(targetPath)}` : '/api/scan';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    projectsData = data.projects || [];
    currentScanPath = data.currentScanPath || '';
    parentScanPath = data.parentPath || null;
    defaultScanPath = data.defaultScanPath || '';

    // Update path input
    pathInput.value = currentScanPath;
    pathInput.title = currentScanPath;

    // Update Up button state
    goUpBtn.disabled = !parentScanPath;
    goUpBtn.classList.toggle('opacity-50', !parentScanPath);

    // Render Subfolders
    renderSubfolders(data.subfolders || []);

    // Update UI Stats & Grid
    updateStats(projectsData);
    renderProjects();
  } catch (err) {
    console.error('Failed to load projects:', err);
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    emptyState.querySelector('h3').textContent = 'Error Scanning Directory';
    emptyState.querySelector('p').textContent = err.message || 'Make sure the folder path exists.';
  } finally {
    loadingState.classList.add('hidden');
  }
}

// Render Subfolders Chips
function renderSubfolders(subfolders) {
  if (!subfolders || subfolders.length === 0) {
    subfoldersBar.classList.add('hidden');
    subfoldersBar.classList.remove('flex');
    return;
  }

  subfoldersBar.classList.remove('hidden');
  subfoldersBar.classList.add('flex');

  subfoldersList.innerHTML = subfolders.map(sub => `
    <button 
      onclick="loadProjects('${escapeHTML(sub.path).replace(/\\/g, '\\\\')}')"
      class="px-2 py-0.5 rounded bg-slate-800/60 hover:bg-cyan-950 hover:text-cyan-300 text-slate-400 border border-white/5 transition-colors text-[10px] truncate max-w-[150px]"
      title="${escapeHTML(sub.path)}"
    >
      📁 ${escapeHTML(sub.name)}
    </button>
  `).join('');
}

// 2. UPDATE TOP STATS STRIP
function updateStats(projects) {
  document.getElementById('statTotalProjects').textContent = projects.length;

  const totalLines = projects.reduce((sum, p) => sum + (p.stats?.totalLines || 0), 0);
  document.getElementById('statTotalLines').textContent = totalLines > 1000 ? `~${(totalLines / 1000).toFixed(1)}k` : totalLines;

  // Active recently (last 30 days)
  const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const activeCount = projects.filter(p => (p.lastActiveFile?.mtime || p.lastModified) > oneMonthAgo).length;
  document.getElementById('statActiveProjects').textContent = activeCount;

  // Tech stack unique count
  const allTools = new Set();
  projects.forEach(p => {
    (p.techStack?.frameworks || []).forEach(f => allTools.add(f));
    (p.techStack?.tools || []).forEach(t => allTools.add(t));
    (p.techStack?.languages || []).forEach(l => allTools.add(l));
  });
  document.getElementById('statTechCount').textContent = allTools.size;
}

// 3. RENDER PROJECT CARDS
function renderProjects() {
  const query = searchQuery.toLowerCase().trim();

  const filtered = projectsData.filter(p => {
    const nameMatch = p.name.toLowerCase().includes(query);
    const stackMatch = (p.techStack?.frameworks || []).some(f => f.toLowerCase().includes(query)) ||
                       (p.techStack?.languages || []).some(l => l.toLowerCase().includes(query)) ||
                       (p.techStack?.tools || []).some(t => t.toLowerCase().includes(query));
    if (query && !nameMatch && !stackMatch) return false;

    if (activeFilter === 'pinned') return p.isPinned;
    if (activeFilter === 'react') return (p.techStack?.frameworks || []).includes('React');
    if (activeFilter === 'node') return (p.techStack?.frameworks || []).includes('Express') || (p.techStack?.tools || []).includes('Node.js');
    if (activeFilter === 'python') return (p.techStack?.languages || []).includes('Python');
    if (activeFilter === 'uncommitted') return (p.gitInfo?.uncommittedCount || 0) > 0;

    return true;
  });

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    projectsGrid.innerHTML = '';
    return;
  }

  emptyState.classList.add('hidden');
  projectsGrid.innerHTML = filtered.map(p => createProjectCardHTML(p)).join('');

  lucide.createIcons();
}

// Create single project card HTML - Clean Monochrome Theme
function createProjectCardHTML(p) {
  const lastActiveTime = p.lastActiveTime || new Date(p.lastModified).toLocaleDateString();
  const recentFileName = p.lastActiveFile?.name || 'No recent file';
  const frameworks = p.techStack?.frameworks || [];
  const tools = p.techStack?.tools || [];
  const languages = p.techStack?.languages || [];
  const allTags = [...frameworks, ...languages, ...tools.filter(t => !['Node.js'].includes(t))].slice(0, 4);

  const hasGit = p.gitInfo?.isGit;
  const uncommitted = p.gitInfo?.uncommittedCount || 0;
  const needsInstall = p.techStack?.needsInstall;
  const missingEnv = p.techStack?.hasEnvExample && !p.techStack?.hasEnv;

  return `
    <div class="glass-card rounded-2xl p-5 flex flex-col justify-between relative group" data-project-id="${p.id}">
      <div>
        <!-- Card Header -->
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-base text-white truncate hover:text-neutral-300 cursor-pointer transition-colors" onclick="openDiagram('${encodeURIComponent(p.path)}')">
                ${escapeHTML(p.name)}
              </h3>
              ${p.isPinned ? `<span class="text-white text-xs" title="Pinned Project">⭐</span>` : ''}
            </div>
            <div class="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
              <i data-lucide="clock" class="w-3 h-3 text-neutral-500"></i>
              <span>Active: ${lastActiveTime}</span>
            </div>
          </div>

          <button onclick="togglePin('${p.id}', ${!p.isPinned})" title="${p.isPinned ? 'Unpin' : 'Pin to Top'}" class="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors">
            <i data-lucide="${p.isPinned ? 'star' : 'star-off'}" class="w-4 h-4 ${p.isPinned ? 'text-white fill-white' : ''}"></i>
          </button>
        </div>

        <!-- Where You Left Off Snippet -->
        <div class="bg-neutral-950 border border-white/10 rounded-xl p-3 mb-3.5">
          <div class="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1 mb-1">
            <i data-lucide="compass" class="w-3 h-3 text-white"></i>
            <span>Where You Left Off</span>
          </div>
          <p class="text-xs text-neutral-200 truncate">
            Last edited: <code class="text-white font-mono text-[11px] bg-neutral-900 border border-white/10 px-1.5 py-0.5 rounded">${escapeHTML(recentFileName)}</code>
          </p>
          ${uncommitted > 0 ? `
            <div class="text-[11px] text-neutral-300 mt-1 flex items-center gap-1.5 font-medium">
              <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              <span>${uncommitted} uncommitted git change${uncommitted > 1 ? 's' : ''}</span>
            </div>
          ` : ''}
        </div>

        <!-- Tags / Stack Badges -->
        <div class="flex flex-wrap gap-1.5 mb-4">
          ${allTags.map(tag => `
            <span class="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-white/10">
              ${escapeHTML(tag)}
            </span>
          `).join('')}
          ${allTags.length === 0 ? `<span class="text-[11px] text-neutral-500 italic">No specific framework</span>` : ''}
        </div>

        <!-- Health & Warnings -->
        <div class="flex flex-wrap items-center gap-2 mb-4 text-[11px]">
          ${hasGit ? `
            <span class="inline-flex items-center gap-1 text-white bg-neutral-900 px-2 py-0.5 rounded border border-white/15 font-mono">
              <i data-lucide="git-branch" class="w-3 h-3"></i>
              ${escapeHTML(p.gitInfo.branch || 'git')}
            </span>
          ` : `
            <span class="text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded text-[10px] border border-white/5">No Git</span>
          `}

          ${needsInstall ? `
            <span class="inline-flex items-center gap-1 text-neutral-200 bg-neutral-900 px-2 py-0.5 rounded border border-white/20">
              <i data-lucide="alert-triangle" class="w-3 h-3 text-white"></i>
              Needs npm i
            </span>
          ` : ''}

          ${missingEnv ? `
            <span class="inline-flex items-center gap-1 text-neutral-300 bg-neutral-900 px-2 py-0.5 rounded border border-white/20">
              <i data-lucide="key" class="w-3 h-3 text-white"></i>
              Missing .env
            </span>
          ` : ''}

          <span class="text-neutral-500 text-[11px] ml-auto font-mono">
            ${p.stats?.fileCount || 0} files • ~${p.stats?.totalLines || 0} lines
          </span>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="border-t border-white/10 pt-3 flex items-center justify-between gap-1 text-xs">
        <div class="flex items-center gap-1.5">
          <button 
            onclick="openDiagram('${encodeURIComponent(p.path)}')"
            class="px-2.5 py-1.5 rounded-lg bg-white text-black font-extrabold hover:bg-neutral-200 transition-all flex items-center gap-1 text-xs shadow-sm shadow-white/10"
            title="View Visual Architecture"
          >
            <i data-lucide="network" class="w-3.5 h-3.5"></i>
            <span>Map</span>
          </button>

          <button 
            onclick="openAIInsights('${p.id}')"
            class="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white border border-white/15 transition-all flex items-center gap-1 font-semibold text-xs"
            title="AI Memory & Next Steps"
          >
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            <span>AI Next</span>
          </button>

          <button 
            onclick="openShowcase('${p.id}')"
            class="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
            title="Portfolio Card"
          >
            <i data-lucide="badge-check" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <div class="flex items-center gap-1">
          <button 
            onclick="openInVSCode('${encodeURIComponent(p.path)}')"
            class="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
            title="Open in VS Code"
          >
            <i data-lucide="code" class="w-3.5 h-3.5"></i>
          </button>

          <button 
            onclick="openInFolder('${encodeURIComponent(p.path)}')"
            class="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
            title="Open in Explorer"
          >
            <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

// 4. OPEN ARCHITECTURE DIAGRAM (NEVER CUT OFF)
window.openDiagram = async function(encodedPath) {
  currentDiagramPath = decodeURIComponent(encodedPath);
  currentZoom = 1.0;
  updateZoomUI();

  diagramModal.classList.remove('hidden');
  diagramModal.classList.add('flex');

  await renderCurrentDiagram();
};

async function renderCurrentDiagram() {
  mermaidTarget.innerHTML = `<div class="p-8 text-slate-400 flex items-center gap-2"><div class="w-4 h-4 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div> Generating architecture map...</div>`;

  try {
    const res = await fetch(`/api/diagram?path=${encodeURIComponent(currentDiagramPath)}&direction=${currentDiagramDirection}`);
    const data = await res.json();
    currentDiagramCode = data.diagram;
    document.getElementById('diagramProjectTitle').textContent = `${data.projectName} Architecture`;

    // Render Mermaid
    const id = `mermaid-svg-${Date.now()}`;
    const { svg } = await mermaid.render(id, currentDiagramCode);
    mermaidTarget.innerHTML = svg;

    // Fix SVG viewBox & inline styles so it NEVER clips at start or ending
    const svgEl = mermaidTarget.querySelector('svg');
    if (svgEl) {
      svgEl.style.maxWidth = 'none';
      svgEl.style.width = 'auto';
      svgEl.style.height = 'auto';
      svgEl.style.overflow = 'visible';

      // Read current viewBox
      const viewBox = svgEl.getAttribute('viewBox');
      if (viewBox) {
        const [x, y, w, h] = viewBox.split(' ').map(Number);
        // Expand padding by 30px on all sides so borders never touch edge
        svgEl.setAttribute('viewBox', `${x - 20} ${y - 20} ${w + 40} ${h + 40}`);
      }
    }

    applyZoom();
    lucide.createIcons();
  } catch (err) {
    mermaidTarget.innerHTML = `<div class="text-rose-400 text-xs p-8">Failed to generate diagram: ${err.message}</div>`;
  }
}

// Zoom Handlers
function applyZoom() {
  mermaidTarget.style.transform = `scale(${currentZoom})`;
  updateZoomUI();
}

function updateZoomUI() {
  zoomLevelDisplay.textContent = `${Math.round(currentZoom * 100)}%`;
}

zoomInBtn.addEventListener('click', () => {
  if (currentZoom < 2.5) {
    currentZoom = Math.min(2.5, currentZoom + 0.15);
    applyZoom();
  }
});

zoomOutBtn.addEventListener('click', () => {
  if (currentZoom > 0.4) {
    currentZoom = Math.max(0.4, currentZoom - 0.15);
    applyZoom();
  }
});

zoomResetBtn.addEventListener('click', () => {
  currentZoom = 1.0;
  applyZoom();
  document.getElementById('diagramViewport').scrollTop = 0;
});

// Toggle Orientation (TD vs LR)
toggleOrientationBtn.addEventListener('click', () => {
  currentDiagramDirection = currentDiagramDirection === 'TD' ? 'LR' : 'TD';
  orientLabel.textContent = currentDiagramDirection === 'TD' ? '⬇️ Top-Down' : '➡️ Left-to-Right';
  renderCurrentDiagram();
});

// 5. OPEN AI INSIGHTS & NEXT STEPS MODAL
window.openAIInsights = async function(projectId) {
  const project = projectsData.find(p => p.id === projectId);
  if (!project) return;

  aiModal.classList.remove('hidden');
  aiModal.classList.add('flex');

  document.getElementById('aiModalTitle').textContent = `${project.name} - Memory & Next Steps`;
  document.getElementById('aiSummaryText').textContent = 'Analyzing project code and git history...';
  document.getElementById('aiStateText').textContent = 'Evaluating...';
  document.getElementById('aiLeftOffText').textContent = 'Checking files...';
  document.getElementById('aiNextStepsList').innerHTML = `<li class="text-slate-400 italic">Thinking of next actions...</li>`;

  try {
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project })
    });
    const insights = await res.json();
    currentInsightsData = insights;

    document.getElementById('aiSummaryText').textContent = insights.summary || 'No summary available.';
    document.getElementById('aiStateText').textContent = insights.currentState || 'In Development';
    document.getElementById('aiLeftOffText').textContent = insights.whereYouLeftOff || 'Ready to resume.';

    const steps = insights.suggestedNextSteps || [];
    document.getElementById('aiNextStepsList').innerHTML = steps.map((s, i) => `
      <li class="flex items-start gap-2 bg-slate-900/90 p-2.5 rounded-lg border border-purple-500/10">
        <span class="w-5 h-5 rounded-md bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
          ${i + 1}
        </span>
        <span class="text-slate-200 leading-snug">${escapeHTML(s)}</span>
      </li>
    `).join('');

    lucide.createIcons();
  } catch (err) {
    document.getElementById('aiSummaryText').textContent = `Error: ${err.message}`;
  }
};

// 6. OPEN SHOWCASE / PORTFOLIO CARD MODAL
window.openShowcase = function(projectId) {
  const project = projectsData.find(p => p.id === projectId);
  if (!project) return;
  currentProjectForShowcase = project;

  showcaseModal.classList.remove('hidden');
  showcaseModal.classList.add('flex');

  document.getElementById('scTitle').textContent = project.name;
  document.getElementById('scLinesBadge').textContent = `~${project.stats?.totalLines || 0} Lines of Code`;

  const desc = project.readmeSnippet 
    ? project.readmeSnippet.slice(0, 180) + '...' 
    : `A software project built with ${project.techStack?.frameworks?.join(', ') || 'modern web technologies'}.`;
  document.getElementById('scDesc').textContent = desc;

  const tags = [...(project.techStack?.frameworks || []), ...(project.techStack?.languages || []), ...(project.techStack?.tools || [])];
  document.getElementById('scTags').innerHTML = tags.map(t => `
    <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
      ${escapeHTML(t)}
    </span>
  `).join('');

  lucide.createIcons();
};

// Pin Project
window.togglePin = async function(projectId, isPinned) {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, isPinned })
    });

    const p = projectsData.find(item => item.id === projectId);
    if (p) p.isPinned = isPinned;
    renderProjects();
  } catch (err) {
    console.error('Failed to toggle pin:', err);
  }
};

// Open in VS Code
window.openInVSCode = async function(encodedPath) {
  try {
    const res = await fetch('/api/open-vscode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: decodeURIComponent(encodedPath) })
    });
    if (!res.ok) alert('Could not launch VS Code. Ensure "code" is in your system PATH.');
  } catch (err) {
    alert(err.message);
  }
};

// Open in Folder
window.openInFolder = async function(encodedPath) {
  fetch('/api/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: decodeURIComponent(encodedPath) })
  });
};

// Path Navigation Handlers
scanPathBtn.addEventListener('click', () => {
  const target = pathInput.value.trim();
  if (target) loadProjects(target);
});

pathInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const target = pathInput.value.trim();
    if (target) loadProjects(target);
  }
});

goUpBtn.addEventListener('click', () => {
  if (parentScanPath) loadProjects(parentScanPath);
});

// Preset Pills Handler
document.querySelectorAll('.preset-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset;
    if (preset === 'projects-by-me') {
      loadProjects(defaultScanPath);
    } else if (preset === 'desktop') {
      loadProjects('C:\\Users\\goura\\OneDrive\\Desktop');
    } else if (preset === 'trial') {
      loadProjects('C:\\Users\\goura\\OneDrive\\Desktop\\projects by me\\trial');
    }
  });
});

// Copy Helpers
document.getElementById('copyDiagramBtn').addEventListener('click', () => {
  if (currentDiagramCode) {
    navigator.clipboard.writeText(currentDiagramCode);
    alert('Mermaid diagram code copied to clipboard!');
  }
});

document.getElementById('aiCopyTasksBtn').addEventListener('click', () => {
  if (currentInsightsData?.suggestedNextSteps) {
    const text = currentInsightsData.suggestedNextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    navigator.clipboard.writeText(text);
    alert('Next steps copied to clipboard!');
  }
});

// 1. WhatsApp 1-Click Direct Share
document.getElementById('shareWhatsAppBtn').addEventListener('click', () => {
  if (currentProjectForShowcase) {
    const p = currentProjectForShowcase;
    const tags = [...(p.techStack?.frameworks || []), ...(p.techStack?.languages || []), ...(p.techStack?.tools || [])].join(', ');
    const desc = p.readmeSnippet ? p.readmeSnippet.slice(0, 200).trim() : 'Personal software project.';
    const text = `🚀 *Check out my project: ${p.name}!*\n\n💻 *Tech Stack:* ${tags || 'JavaScript'}\n📊 *Scale:* ~${p.stats?.totalLines || 0} lines of code (${p.stats?.fileCount || 0} files)\n📝 *About:* ${desc}\n\nBuilt with ❤️ by me.`;
    
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }
});

// 2. Copy WhatsApp Formatted Text
document.getElementById('copyWhatsAppTextBtn').addEventListener('click', () => {
  if (currentProjectForShowcase) {
    const p = currentProjectForShowcase;
    const tags = [...(p.techStack?.frameworks || []), ...(p.techStack?.languages || []), ...(p.techStack?.tools || [])].join(', ');
    const desc = p.readmeSnippet ? p.readmeSnippet.slice(0, 200).trim() : 'Personal software project.';
    const text = `🚀 *Check out my project: ${p.name}!*\n\n💻 *Tech Stack:* ${tags || 'JavaScript'}\n📊 *Scale:* ~${p.stats?.totalLines || 0} lines of code (${p.stats?.fileCount || 0} files)\n📝 *About:* ${desc}`;
    
    navigator.clipboard.writeText(text);
    alert('WhatsApp formatted text copied! You can paste it into any WhatsApp chat.');
  }
});

// 3. Copy LinkedIn / Discord Social Post
document.getElementById('copySocialPostBtn').addEventListener('click', () => {
  if (currentProjectForShowcase) {
    const p = currentProjectForShowcase;
    const tags = [...(p.techStack?.frameworks || []), ...(p.techStack?.languages || [])].join(', ');
    const desc = p.readmeSnippet ? p.readmeSnippet.slice(0, 250).trim() : 'A web and software project built from scratch.';
    const post = `🚀 Excited to share my project: ${p.name}!\n\n💻 Built with: ${tags || 'Modern Web Stack'}\n📊 Scale: ~${p.stats?.totalLines || 0} lines of code across ${p.stats?.fileCount || 0} files\n\n📌 What it does:\n${desc}\n\n#Developer #Projects #Coding #WebDevelopment #Portfolio`;
    
    navigator.clipboard.writeText(post);
    alert('LinkedIn & Discord post copied to clipboard!');
  }
});

// 4. Copy GitHub Markdown
document.getElementById('copyShowcaseMarkdownBtn').addEventListener('click', () => {
  if (currentProjectForShowcase) {
    const p = currentProjectForShowcase;
    const tags = [...(p.techStack?.frameworks || []), ...(p.techStack?.languages || [])].join(' • ');
    const md = `### 🚀 ${p.name}\n\n**Tech Stack:** ${tags}\n**Lines of Code:** ~${p.stats?.totalLines || 0}\n\n${p.readmeSnippet ? p.readmeSnippet.slice(0, 300) : 'Personal development project.'}\n`;
    navigator.clipboard.writeText(md);
    alert('GitHub README Markdown copied to clipboard!');
  }
});

// Share App Modal Open & Button Handlers
shareAppBtn.addEventListener('click', () => {
  shareAppModal.classList.remove('hidden');
  shareAppModal.classList.add('flex');
  lucide.createIcons();
});

document.getElementById('copyNpxCmdBtn').addEventListener('click', () => {
  navigator.clipboard.writeText('npx devmemory');
  alert('Copied "npx devmemory" to clipboard! You can run it in any terminal.');
});

document.getElementById('copyGitCloneBtn').addEventListener('click', () => {
  navigator.clipboard.writeText('git clone https://github.com/Gourav-Dadheech/DevMemory.git');
  alert('Copied git clone command to clipboard!');
});

// Modal Close Handlers
document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('click', () => {
    [diagramModal, aiModal, showcaseModal, settingsModal, shareAppModal].forEach(m => {
      m.classList.add('hidden');
      m.classList.remove('flex');
    });
  });
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    [diagramModal, aiModal, showcaseModal, settingsModal, shareAppModal].forEach(m => {
      m.classList.add('hidden');
      m.classList.remove('flex');
    });
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
  }
});

// Search and Filter Listeners
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderProjects();
});

document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(b => {
      b.classList.remove('active', 'bg-white', 'text-black', 'bg-cyan-500', 'text-slate-950');
      b.classList.add('bg-neutral-900', 'text-neutral-300');
    });
    btn.classList.add('active', 'bg-white', 'text-black');
    btn.classList.remove('bg-neutral-900', 'text-neutral-300');

    activeFilter = btn.dataset.filter;
    renderProjects();
  });
});

refreshBtn.addEventListener('click', () => loadProjects(currentScanPath));

settingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
  settingsModal.classList.add('flex');
  lucide.createIcons();
});

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKeyInput').value.trim();

  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  });

  settingsModal.classList.add('hidden');
  settingsModal.classList.remove('flex');
  loadProjects(currentScanPath);
});

// Helper: Escape HTML
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Initial Boot
loadProjects();
lucide.createIcons();
