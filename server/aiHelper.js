/**
 * AI Helper for DevMemory
 * Supports both Google Gemini Free API (when user provides key)
 * and an intelligent offline rule-based analyzer (requires ₹0 and no internet).
 */

export async function generateProjectInsights(project, apiKey = null) {
  // If user provided a Gemini API key, use it
  if (apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are an expert tech lead assisting a developer. Analyze this project metadata and provide a concise JSON response.
Project Name: ${project.name}
Tech Stack: ${JSON.stringify(project.techStack)}
Total Files: ${project.stats.fileCount}, Total Lines of Code: ${project.stats.totalLines}
Recent Active File: ${JSON.stringify(project.lastActiveFile)}
Git Info: ${JSON.stringify(project.gitInfo)}
Readme Snippet: ${project.readmeSnippet || 'None'}

Return ONLY valid JSON with this exact schema:
{
  "summary": "1-2 sentence description of what this project does",
  "currentState": "Current development phase (e.g., Early Prototype, Active Feature Development, Polishing, Production Ready)",
  "whereYouLeftOff": "Actionable explanation of where work stopped based on recent files and git commits",
  "suggestedNextSteps": [
    "Specific task 1",
    "Specific task 2",
    "Specific task 3"
  ]
}`
                  }
                ]
              }
            ]
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(cleaned);
        }
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local heuristic engine:', err.message);
    }
  }

  // --- Offline Smart Heuristic Engine (100% Free, No Internet Needed) ---
  return generateOfflineInsights(project);
}

function generateOfflineInsights(project) {
  const { name, techStack, stats, gitInfo, lastActiveFile, readmeSnippet } = project;
  const frameworks = techStack?.frameworks || [];
  const tools = techStack?.tools || [];
  const languages = techStack?.languages || [];

  // 1. Generate Summary
  let summary = '';
  if (name.toLowerCase().includes('whatsapp')) {
    summary = 'An automated WhatsApp bot integration using webhooks to handle incoming messages and deliver automated responses.';
  } else if (name.toLowerCase().includes('jarvis') || name.toLowerCase().includes('neev')) {
    summary = 'A personalized AI assistant interface capable of processing user queries, natural language workflows, or automation.';
  } else if (name.toLowerCase().includes('cinverse')) {
    summary = 'A multimedia or cinema discovery platform showcasing movies, shows, or multiverse media content.';
  } else if (frameworks.includes('React') || frameworks.includes('Next.js')) {
    summary = `A modern ${frameworks.join('/')} frontend application built with ${languages.join(', ') || 'JavaScript'}.`;
  } else if (frameworks.includes('Express')) {
    summary = 'A Node.js backend REST API server handling request routing, data processing, and external services.';
  } else if (languages.includes('Python')) {
    summary = `A Python-based application focusing on scripting, backend automation, or data handling.`;
  } else {
    summary = `A ${languages[0] || 'custom'} software project with ${stats.fileCount} files and ~${stats.totalLines} lines of code.`;
  }

  // 2. Assess Current State
  let currentState = 'Active Prototype';
  if (stats.totalLines > 3000 || (gitInfo.recentCommits && gitInfo.recentCommits.length > 10)) {
    currentState = 'Mature / Advanced Feature Phase';
  } else if (stats.totalLines > 500) {
    currentState = 'Active Feature Development';
  } else {
    currentState = 'Initial Architecture / Scaffolding';
  }

  // 3. Where you left off
  let whereYouLeftOff = 'Project is idle.';
  if (lastActiveFile) {
    whereYouLeftOff = `You were recently working on '${lastActiveFile.name}' (${new Date(lastActiveFile.mtime).toLocaleDateString()}).`;
    if (gitInfo.uncommittedCount > 0) {
      whereYouLeftOff += ` You have ${gitInfo.uncommittedCount} uncommitted file changes pending in git.`;
    }
  } else if (gitInfo.recentCommits?.[0]) {
    whereYouLeftOff = `Last commit: "${gitInfo.recentCommits[0].message}" (${gitInfo.recentCommits[0].timeAgo}).`;
  }

  // 4. Suggested Next Steps
  const suggestedNextSteps = [];

  if (techStack.needsInstall) {
    suggestedNextSteps.push(`Run '${techStack.packageManager} install' to set up missing dependencies.`);
  }

  if (techStack.hasEnvExample && !techStack.hasEnv) {
    suggestedNextSteps.push('Create a .env file from .env.example with your required API keys.');
  }

  if (lastActiveFile) {
    suggestedNextSteps.push(`Continue editing '${lastActiveFile.name}' and verify recent changes.`);
  }

  if (!gitInfo.isGit) {
    suggestedNextSteps.push('Initialize Git repository (git init) to back up your progress.');
  } else if (gitInfo.uncommittedCount > 0) {
    suggestedNextSteps.push(`Commit your ${gitInfo.uncommittedCount} pending changes (git commit -m "update").`);
  }

  if (!readmeSnippet) {
    suggestedNextSteps.push('Add a README.md documenting how to run this project.');
  }

  suggestedNextSteps.push('Add automated tests or deploy a live preview on Vercel / GitHub Pages.');

  return {
    summary,
    currentState,
    whereYouLeftOff,
    suggestedNextSteps: suggestedNextSteps.slice(0, 3)
  };
}
