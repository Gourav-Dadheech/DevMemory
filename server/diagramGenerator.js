/**
 * Generate a clean Mermaid.js diagram based on the project's detected structure and tech stack.
 * Supports both Top-Down ('TD') and Left-to-Right ('LR') orientations with professional monochrome styling.
 */
export function generateMermaidDiagram(project, direction = 'TD') {
  const { techStack, stats, name } = project;
  const frameworks = techStack?.frameworks || [];
  const tools = techStack?.tools || [];
  const ext = stats?.extBreakdown || {};

  const cleanName = (name || 'Project').replace(/["\\]/g, '');
  let lines = [`graph ${direction}`];

  // Professional Monochrome Theme styling classes
  lines.push('  %% Minimalist Monochrome Theme');
  lines.push('  classDef client fill:#171717,stroke:#ffffff,stroke-width:1.5px,color:#ffffff;');
  lines.push('  classDef api fill:#222222,stroke:#d4d4d8,stroke-width:1.5px,color:#ffffff;');
  lines.push('  classDef ext fill:#121212,stroke:#71717a,stroke-width:1.5px,color:#a1a1aa;');
  lines.push('  classDef store fill:#1c1c1c,stroke:#e4e4e7,stroke-width:1.5px,color:#ffffff;');

  // Entry point
  lines.push(`  User["👤 User / Client"]:::client`);

  const isFullstack = (frameworks.includes('React') || frameworks.includes('HTML5/Vanilla Web')) &&
                      (frameworks.includes('Express') || tools.includes('Node.js'));
  const isPython = techStack?.languages?.includes('Python');
  const hasGemini = tools.includes('Google Gemini AI') || tools.includes('Gemini AI');
  const hasWhatsApp = cleanName.toLowerCase().includes('whatsapp');
  const hasSocket = tools.includes('Socket.io');

  if (isFullstack) {
    const fwLabel = frameworks.filter(f => f !== 'Express').join('/') || 'Web UI';
    lines.push(`  UI["💻 Frontend (${fwLabel})"]:::client`);
    lines.push(`  Server["⚡ Express API Server"]:::api`);
    lines.push(`  User -->|HTTP / Interacts| UI`);
    lines.push(`  UI -->|REST / Fetch API| Server`);

    if (hasSocket) {
      lines.push(`  WS["🔄 Socket.io Realtime"]:::api`);
      lines.push(`  UI <-->|WebSocket Events| WS`);
      lines.push(`  WS --- Server`);
    }

    if (hasGemini) {
      lines.push(`  Gemini["🤖 Google Gemini API"]:::ext`);
      lines.push(`  Server -->|Prompt / Response| Gemini`);
    }

    if (hasWhatsApp) {
      lines.push(`  Meta["📱 WhatsApp Cloud Webhook"]:::ext`);
      lines.push(`  Server <-->|Webhook Verify & Send| Meta`);
    }

    lines.push(`  Storage[("💾 Local JSON / State Store")]:::store`);
    lines.push(`  Server -->|Read / Write| Storage`);

  } else if (frameworks.includes('Express') || tools.includes('Node.js')) {
    lines.push(`  Server["⚡ Node.js / Express Server"]:::api`);
    lines.push(`  User -->|Requests| Server`);

    if (hasWhatsApp) {
      lines.push(`  Meta["📱 WhatsApp Cloud API"]:::ext`);
      lines.push(`  Server <-->|Webhooks / Messages| Meta`);
    }
    if (hasGemini) {
      lines.push(`  Gemini["🤖 Google Gemini AI"]:::ext`);
      lines.push(`  Server -->|Prompts| Gemini`);
    }

    lines.push(`  Storage[("💾 Local Storage / DB")]:::store`);
    lines.push(`  Server -->|Data Persistence| Storage`);

  } else if (isPython) {
    const pyFramework = frameworks.find(f => ['Flask', 'FastAPI', 'Django'].includes(f)) || 'Python App';
    lines.push(`  PyApp["🐍 ${pyFramework}"]:::api`);
    lines.push(`  User -->|CLI / Web Request| PyApp`);

    if (hasGemini || tools.includes('OpenAI')) {
      lines.push(`  LLM["🤖 AI Model Service"]:::ext`);
      lines.push(`  PyApp -->|Inference| LLM`);
    }

    lines.push(`  Data[("📁 Data / Files")]:::store`);
    lines.push(`  PyApp -->|I/O| Data`);

  } else if (frameworks.includes('React') || frameworks.includes('Vue') || frameworks.includes('Next.js')) {
    lines.push(`  UI["💻 ${frameworks.join(', ')} App"]:::client`);
    lines.push(`  State["🧠 State / Hooks Layer"]:::api`);
    lines.push(`  User --> UI`);
    lines.push(`  UI --> State`);

    lines.push(`  Services["🌐 External APIs / Endpoints"]:::ext`);
    lines.push(`  State -->|Fetch / Axios| Services`);

  } else {
    // Generic fallback based on files
    lines.push(`  App["📦 ${cleanName}"]:::client`);
    lines.push(`  User --> App`);
    if (ext['.html']) lines.push(`  Pages["📄 HTML Pages"]:::client\n  App --> Pages`);
    if (ext['.js'] || ext['.ts']) lines.push(`  Scripts["⚙️ JavaScript Logic"]:::api\n  App --> Scripts`);
    if (ext['.css']) lines.push(`  Styles["🎨 CSS Stylesheets"]:::client\n  App --> Styles`);
  }

  return lines.join('\n');
}
