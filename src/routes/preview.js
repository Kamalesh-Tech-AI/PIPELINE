import { Router } from 'express';
import { RunStore } from '../services/run-store.js';
import { WorkerManager } from '../services/worker-manager.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const router = Router();
const runStore = new RunStore();
const workerManager = new WorkerManager();

// GET /preview/:runId - Serve preview content
router.get('/:runId/*?', async (req, res) => {
  const { runId } = req.params;
  const requestPath = req.params[0] || '';
  
  try {
    const run = runStore.get(runId);
    
    if (!run) {
      return res.status(404).send(`
        <html>
          <head><title>Preview Not Found</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Preview Not Found</h1>
            <p>The requested preview does not exist or has expired.</p>
            <a href="/" style="color: #007bff;">Return to Home</a>
          </body>
        </html>
      `);
    }

    if (run.status !== 'ready') {
      return res.status(503).send(`
        <html>
          <head>
            <title>Preview Not Ready</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa;">
            <h1>Preview Not Ready</h1>
            <p>Status: ${run.status}</p>
            <div style="margin: 20px 0;">
              <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            </div>
            <p style="color: #666;">Building your project...</p>
            <script>
              // Auto-refresh every 2 seconds until ready
              setTimeout(() => window.location.reload(), 2000);
            </script>
            <style>
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </body>
        </html>
      `);
    }

    // Get content from worker or serve simulated content
    let content;
    if (run.workerId) {
      const worker = workerManager.get(run.workerId);
      if (worker) {
        content = await worker.getContent(requestPath);
      } else {
        content = generateFallbackContent(requestPath, run);
      }
    } else {
      content = generateFallbackContent(requestPath, run);
    }
    
    // Apply strict security headers
    res.set({
      'Content-Security-Policy': getCSPForProject(run.projectType),
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    });

    // Determine content type
    const contentType = getContentType(requestPath);
    res.set('Content-Type', contentType);

    res.send(content);

  } catch (error) {
    logger.error(`Preview error for run ${runId}:`, error);
    res.status(500).send('Preview error');
  }
});

function generateFallbackContent(path, run) {
  if (!path || path === '' || path === 'index.html') {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sandboxed Preview - ${run.projectType || 'Unknown'}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            max-width: 800px; 
            margin: 40px auto; 
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            box-sizing: border-box;
          }
          .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
          }
          h1 { color: #fff; margin-bottom: 20px; }
          .badge { 
            display: inline-block; 
            background: rgba(255, 255, 255, 0.2); 
            padding: 5px 15px; 
            border-radius: 20px; 
            font-size: 14px; 
            margin-bottom: 20px;
          }
          .info { margin: 20px 0; padding: 15px; background: rgba(255, 255, 255, 0.1); border-radius: 8px; }
          .warning { background: rgba(255, 193, 7, 0.2); color: #fff; padding: 15px; border-radius: 8px; margin: 20px 0; }
          button { 
            background: rgba(255, 255, 255, 0.2); 
            border: 1px solid rgba(255, 255, 255, 0.3); 
            color: white; 
            padding: 10px 20px; 
            border-radius: 8px; 
            cursor: pointer; 
            margin: 10px 5px 0 0;
            transition: all 0.3s ease;
          }
          button:hover { background: rgba(255, 255, 255, 0.3); }
          .status { margin-top: 20px; font-family: monospace; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔒 Sandboxed Preview</h1>
          <div class="badge">Project Type: ${(run.projectType || 'UNKNOWN').toUpperCase()}</div>
          
          <div class="info">
            <strong>✅ Security Features Active:</strong>
            <ul>
              <li>Content Security Policy (CSP) enforced</li>
              <li>Iframe sandbox restrictions applied</li>
              <li>Cross-origin isolation enabled</li>
              <li>Resource access limited</li>
              <li>Network requests restricted</li>
            </ul>
          </div>
          
          <div class="warning">
            <strong>⚠️ Sandbox Notice:</strong> This preview runs in a secure, isolated environment. 
            Some features may be restricted for security purposes.
          </div>
          
          <div>
            <h3>Test Sandbox Restrictions:</h3>
            <button onclick="testPopup()">Test Popup (Should Fail)</button>
            <button onclick="testTopNavigation()">Test Navigation (Should Fail)</button>
            <button onclick="testPostMessage()">Test PostMessage</button>
            <button onclick="testXHR()">Test Network Request</button>
          </div>
          
          <div class="status" id="status"></div>
        </div>

        <script>
          const status = document.getElementById('status');
          
          function log(message, type = 'info') {
            const timestamp = new Date().toLocaleTimeString();
            const color = type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#74c0fc';
            status.innerHTML += \`<div style="color: \${color}">[\${timestamp}] \${message}</div>\`;
          }
          
          function testPopup() {
            try {
              const popup = window.open('about:blank', '_blank');
              if (popup) {
                log('Popup opened (unexpected in sandbox)', 'error');
                popup.close();
              } else {
                log('Popup blocked by sandbox ✓', 'success');
              }
            } catch (e) {
              log('Popup blocked by sandbox ✓', 'success');
            }
          }
          
          function testTopNavigation() {
            try {
              window.top.location.href = 'about:blank';
              log('Top navigation succeeded (security issue!)', 'error');
            } catch (e) {
              log('Top navigation blocked by sandbox ✓', 'success');
            }
          }
          
          function testPostMessage() {
            try {
              window.parent.postMessage({
                type: 'sandbox-test',
                message: 'Hello from sandboxed iframe',
                timestamp: Date.now()
              }, '*');
              log('PostMessage sent ✓', 'success');
            } catch (e) {
              log(\`PostMessage failed: \${e.message}\`, 'error');
            }
          }
          
          async function testXHR() {
            try {
              const response = await fetch('/api/test');
              log('Network request succeeded', 'success');
            } catch (e) {
              log(\`Network request failed: \${e.message}\`, 'info');
            }
          }
          
          // Initialize
          log('Sandbox environment initialized');
          log(\`Run ID: ${run.id}\`);
          log(\`Project Type: ${run.projectType || 'Unknown'}\`);
          log('Ready for testing');
        </script>
      </body>
      </html>
    `;
  }
  
  // Handle other file types
  if (path.endsWith('.js')) {
    return `
      // Simulated JavaScript content for ${path}
      console.log('Loading ${path} in sandbox environment');
      console.log('Run ID: ${run.id}');
      
      // Test sandbox restrictions
      try {
        // This should fail in a properly sandboxed environment
        document.domain = 'evil.com';
        console.warn('document.domain modification succeeded - potential security issue');
      } catch (e) {
        console.log('document.domain modification blocked ✓');
      }
    `;
  }
  
  if (path.endsWith('.css')) {
    return `
      /* Simulated CSS content for ${path} */
      body { 
        background: linear-gradient(45deg, #3498db, #8e44ad);
        color: white;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
    `;
  }
  
  return `Simulated content for ${path} in run ${run.id}`;
}

function getCSPForProject(projectType) {
  switch (projectType) {
    case 'static':
      return config.security.csp.strict;
    case 'react':
    case 'vue':
    case 'angular':
      // SPA apps might need slightly relaxed CSP for inline scripts during hydration
      return config.security.csp.relaxed;
    default:
      return config.security.csp.strict;
  }
}

function getContentType(path) {
  if (!path || path.endsWith('/') || path.endsWith('.html')) {
    return 'text/html';
  }
  if (path.endsWith('.js')) {
    return 'application/javascript';
  }
  if (path.endsWith('.css')) {
    return 'text/css';
  }
  if (path.endsWith('.json')) {
    return 'application/json';
  }
  if (path.endsWith('.png')) {
    return 'image/png';
  }
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return 'text/plain';
}

export { router as previewRouter };