import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.vscode',
  '.idea'
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.scss',
  '.json', '.sql', '.java', '.cpp', '.c', '.go', '.rs', '.php',
  '.vue', '.svelte', '.sh', '.bat', '.ps1'
]);

/**
 * Recursively inspect a directory for files and stats
 */
async function walkDirectory(dirPath, maxDepth = 4, currentDepth = 0) {
  let fileCount = 0;
  let totalLines = 0;
  const extBreakdown = {};
  const recentFiles = [];

  if (currentDepth > maxDepth) {
    return { fileCount, totalLines, extBreakdown, recentFiles };
  }

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const sub = await walkDirectory(fullPath, maxDepth, currentDepth + 1);
        fileCount += sub.fileCount;
        totalLines += sub.totalLines;
        for (const [ext, count] of Object.entries(sub.extBreakdown)) {
          extBreakdown[ext] = (extBreakdown[ext] || 0) + count;
        }
        recentFiles.push(...sub.recentFiles);
      } else if (entry.isFile()) {
        fileCount++;
        const ext = path.extname(entry.name).toLowerCase();
        if (ext) {
          extBreakdown[ext] = (extBreakdown[ext] || 0) + 1;
        }

        try {
          const stat = await fs.promises.stat(fullPath);
          recentFiles.push({
            name: entry.name,
            relativePath: path.relative(dirPath, fullPath),
            mtime: stat.mtimeMs,
            size: stat.size
          });

          // Count lines if code file and reasonably sized (< 1MB)
          if (CODE_EXTENSIONS.has(ext) && stat.size < 1024 * 1024) {
            const content = await fs.promises.readFile(fullPath, 'utf8');
            totalLines += content.split('\n').length;
          }
        } catch {
          // Skip inaccessible file
        }
      }
    }
  } catch {
    // Directory unreadable
  }

  // Keep top 10 most recently modified
  recentFiles.sort((a, b) => b.mtime - a.mtime);

  return {
    fileCount,
    totalLines,
    extBreakdown,
    recentFiles: recentFiles.slice(0, 10)
  };
}

/**
 * Check if a directory is likely a project
 */
async function isProjectDirectory(dirPath) {
  try {
    const files = await fs.promises.readdir(dirPath);
    const fileSet = new Set(files);
    return fileSet.has('package.json') ||
           fileSet.has('requirements.txt') ||
           fileSet.has('Pipfile') ||
           fileSet.has('pyproject.toml') ||
           fileSet.has('.git') ||
           fileSet.has('index.html') ||
           fileSet.has('Cargo.toml') ||
           fileSet.has('go.mod') ||
           fileSet.has('pom.xml');
  } catch {
    return false;
  }
}

/**
 * Detect tech stack from files & configurations
 */
async function detectTechStack(projectPath) {
  const stack = {
    frameworks: [],
    languages: [],
    tools: [],
    packageManager: 'unknown',
    hasEnv: false,
    hasEnvExample: false,
    needsInstall: false,
    hasGit: false,
    entryPoints: []
  };

  const files = await fs.promises.readdir(projectPath).catch(() => []);
  const fileSet = new Set(files);

  stack.hasGit = fileSet.has('.git');
  stack.hasEnv = fileSet.has('.env');
  stack.hasEnvExample = fileSet.has('.env.example') || fileSet.has('.env.sample');

  // Check Node.js
  if (fileSet.has('package.json')) {
    stack.languages.push('JavaScript');
    stack.tools.push('Node.js');
    stack.packageManager = fileSet.has('pnpm-lock.yaml') ? 'pnpm' :
      fileSet.has('yarn.lock') ? 'yarn' :
      fileSet.has('package-lock.json') ? 'npm' : 'npm';

    stack.needsInstall = !fileSet.has('node_modules');

    try {
      const pkgContent = await fs.promises.readFile(path.join(projectPath, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgContent);
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {})
      };

      if (allDeps['react']) stack.frameworks.push('React');
      if (allDeps['vue']) stack.frameworks.push('Vue');
      if (allDeps['next']) stack.frameworks.push('Next.js');
      if (allDeps['vite']) stack.tools.push('Vite');
      if (allDeps['express']) stack.frameworks.push('Express');
      if (allDeps['tailwindcss']) stack.tools.push('Tailwind CSS');
      if (allDeps['typescript'] || fileSet.has('tsconfig.json')) {
        stack.languages.push('TypeScript');
      }
      if (allDeps['socket.io']) stack.tools.push('Socket.io');
      if (allDeps['electron']) stack.frameworks.push('Electron');
      if (allDeps['axios']) stack.tools.push('Axios');
      if (allDeps['@google/genai'] || allDeps['@google/generative-ai']) {
        stack.tools.push('Google Gemini AI');
      }
      if (allDeps['dotenv']) stack.tools.push('Dotenv');

      if (pkg.main) stack.entryPoints.push(pkg.main);
      if (pkg.scripts) {
        stack.scripts = Object.keys(pkg.scripts);
      }
    } catch {
      // Invalid json
    }
  }

  // Check Python
  if (fileSet.has('requirements.txt') || fileSet.has('Pipfile') || fileSet.has('pyproject.toml') || fileSet.has('main.py')) {
    stack.languages.push('Python');
    if (fileSet.has('requirements.txt')) {
      try {
        const reqs = await fs.promises.readFile(path.join(projectPath, 'requirements.txt'), 'utf8');
        if (/django/i.test(reqs)) stack.frameworks.push('Django');
        if (/flask/i.test(reqs)) stack.frameworks.push('Flask');
        if (/fastapi/i.test(reqs)) stack.frameworks.push('FastAPI');
        if (/torch|pytorch/i.test(reqs)) stack.tools.push('PyTorch');
        if (/langchain/i.test(reqs)) stack.tools.push('LangChain');
        if (/openai/i.test(reqs)) stack.tools.push('OpenAI');
        if (/google-generativeai/i.test(reqs)) stack.tools.push('Gemini AI');
      } catch {}
    }
  }

  // Check Vanilla Web
  if (fileSet.has('index.html') && !stack.frameworks.includes('React') && !stack.frameworks.includes('Next.js')) {
    stack.frameworks.push('HTML5/Vanilla Web');
  }

  // Dedup
  stack.languages = Array.from(new Set(stack.languages));
  stack.frameworks = Array.from(new Set(stack.frameworks));
  stack.tools = Array.from(new Set(stack.tools));

  return stack;
}

/**
 * Get recent git commits & status
 */
async function getGitInfo(projectPath) {
  try {
    const gitDir = path.join(projectPath, '.git');
    if (!fs.existsSync(gitDir)) {
      return { isGit: false, branch: null, recentCommits: [], uncommittedCount: 0 };
    }

    const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
    const { stdout: commitsOut } = await execAsync('git log -n 5 --pretty=format:"%h|%s|%ar|%an"', { cwd: projectPath });
    const { stdout: statusOut } = await execAsync('git status -s', { cwd: projectPath });

    const recentCommits = commitsOut.trim().split('\n').filter(Boolean).map(line => {
      const [hash, message, timeAgo, author] = line.split('|');
      return { hash, message, timeAgo, author };
    });

    const uncommittedFiles = statusOut.trim().split('\n').filter(Boolean);

    return {
      isGit: true,
      branch: branchOut.trim(),
      recentCommits,
      uncommittedCount: uncommittedFiles.length,
      uncommittedPreview: uncommittedFiles.slice(0, 5)
    };
  } catch {
    return { isGit: false, branch: null, recentCommits: [], uncommittedCount: 0 };
  }
}

/**
 * Scan a single project folder
 */
export async function scanProject(projectPath) {
  const stat = await fs.promises.stat(projectPath);
  if (!stat.isDirectory()) return null;

  const name = path.basename(projectPath);
  const [stats, techStack, gitInfo] = await Promise.all([
    walkDirectory(projectPath),
    detectTechStack(projectPath),
    getGitInfo(projectPath)
  ]);

  // Read README if available
  let readmeSnippet = '';
  for (const readmeFile of ['README.md', 'readme.md', 'README.txt']) {
    const readmePath = path.join(projectPath, readmeFile);
    if (fs.existsSync(readmePath)) {
      try {
        const content = await fs.promises.readFile(readmePath, 'utf8');
        readmeSnippet = content.slice(0, 800);
        break;
      } catch {}
    }
  }

  // Where you left off signal
  const lastActiveFile = stats.recentFiles[0] || null;
  const lastActiveTime = lastActiveFile ? new Date(lastActiveFile.mtime).toLocaleString() : new Date(stat.mtime).toLocaleString();

  return {
    id: Buffer.from(projectPath).toString('base64url'),
    name,
    path: projectPath,
    lastModified: stat.mtimeMs,
    lastActiveTime,
    lastActiveFile,
    stats,
    techStack,
    gitInfo,
    readmeSnippet
  };
}

/**
 * Scan directory: supports scanning any root folder, discovers child projects,
 * checks if root is a project itself, and returns available subfolders for easy navigation.
 */
export async function scanRootDirectory(rootDir) {
  const resolved = path.resolve(rootDir);
  const parentPath = path.dirname(resolved);

  const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
  const subfolders = [];
  const candidatePaths = new Set();

  // 1. Check if the root directory itself is a project
  const rootIsProject = await isProjectDirectory(resolved);
  if (rootIsProject) {
    candidatePaths.add(resolved);
  }

  // 2. Inspect direct subdirectories
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

    const fullPath = path.join(resolved, entry.name);
    subfolders.push({ name: entry.name, path: fullPath });

    const isProj = await isProjectDirectory(fullPath);
    if (isProj) {
      candidatePaths.add(fullPath);
    } else {
      // Check 1 level deeper for nested monorepos or project groups
      try {
        const subEntries = await fs.promises.readdir(fullPath, { withFileTypes: true });
        for (const sub of subEntries) {
          if (!sub.isDirectory() || IGNORED_DIRS.has(sub.name) || sub.name.startsWith('.')) continue;
          const nestedPath = path.join(fullPath, sub.name);
          if (await isProjectDirectory(nestedPath)) {
            candidatePaths.add(nestedPath);
          }
        }
      } catch {}
    }
  }

  // Scan all identified candidates
  const projectPromises = Array.from(candidatePaths).map(p => scanProject(p).catch(() => null));
  const results = await Promise.all(projectPromises);
  const validProjects = results.filter(Boolean);

  // Sort by last active / modified
  validProjects.sort((a, b) => {
    const timeA = a.lastActiveFile ? a.lastActiveFile.mtime : a.lastModified;
    const timeB = b.lastActiveFile ? b.lastActiveFile.mtime : b.lastModified;
    return timeB - timeA;
  });

  return {
    scannedPath: resolved,
    parentPath: parentPath !== resolved ? parentPath : null,
    subfolders: subfolders.slice(0, 15),
    totalProjects: validProjects.length,
    projects: validProjects
  };
}
