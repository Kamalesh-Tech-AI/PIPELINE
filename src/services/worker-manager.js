import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Worker manager - handles isolated execution environments
 * In production, this would use Docker + gVisor or similar container runtime
 */
export class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.nextPort = 8000;
  }

  async start(options) {
    const { runId, projectPath, projectType, buildCommand, startCommand } = options;
    
    const worker = new Worker({
      id: `worker-${runId}`,
      runId,
      port: this.nextPort++,
      projectPath,
      projectType,
      buildCommand,
      startCommand
    });

    this.workers.set(worker.id, worker);
    
    try {
      await worker.start();
      logger.info(`Started worker ${worker.id} for run ${runId}`);
      return worker;
    } catch (error) {
      this.workers.delete(worker.id);
      throw error;
    }
  }

  get(workerId) {
    return this.workers.get(workerId);
  }

  async stop(workerId) {
    const worker = this.workers.get(workerId);
    if (worker) {
      await worker.stop();
      this.workers.delete(workerId);
      logger.info(`Stopped worker ${workerId}`);
    }
  }

  async stopAll() {
    const stopPromises = Array.from(this.workers.keys()).map(id => this.stop(id));
    await Promise.all(stopPromises);
  }
}

class Worker {
  constructor(options) {
    this.id = options.id;
    this.runId = options.runId;
    this.port = options.port;
    this.projectPath = options.projectPath;
    this.projectType = options.projectType;
    this.buildCommand = options.buildCommand;
    this.startCommand = options.startCommand;
    this.status = 'created';
    this.startTime = null;
    this.process = null;
  }

  async start() {
    this.status = 'starting';
    this.startTime = Date.now();
    
    try {
      // In a real implementation, this would:
      // 1. Create isolated container with gVisor
      // 2. Mount project files read-only
      // 3. Apply resource limits (CPU, memory, network)
      // 4. Run build command with timeout
      // 5. Start server process
      
      // For demonstration, simulate the process
      await this.simulateBuild();
      await this.simulateStart();
      
      this.status = 'running';
      logger.info(`Worker ${this.id} started successfully on port ${this.port}`);
      
    } catch (error) {
      this.status = 'failed';
      throw error;
    }
  }

  async simulateBuild() {
    logger.info(`Building ${this.projectType} project for worker ${this.id}`);
    
    // Simulate build time based on project type
    const buildTime = {
      'static': 500,
      'react': 3000,
      'vue': 3000,
      'angular': 5000,
      'node': 2000
    }[this.projectType] || 1000;
    
    await new Promise(resolve => setTimeout(resolve, buildTime));
    
    // Simulate potential build failure (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Simulated build failure');
    }
  }

  async simulateStart() {
    logger.info(`Starting server for worker ${this.id} on port ${this.port}`);
    
    // Simulate server startup time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In real implementation, health check the actual server
    this.healthCheckInterval = setInterval(() => {
      // Simulate health check
    }, 30000);
  }

  async waitUntilReady(timeout = 30000) {
    const startTime = Date.now();
    
    while (this.status !== 'running' && this.status !== 'failed') {
      if (Date.now() - startTime > timeout) {
        throw new Error('Worker startup timeout');
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.status === 'failed') {
      throw new Error('Worker failed to start');
    }
  }

  async getContent(path) {
    if (this.status !== 'running') {
      throw new Error('Worker not running');
    }

    // In real implementation, proxy to actual worker HTTP server
    // For demonstration, return simulated content
    return this.generateSimulatedContent(path);
  }

  generateSimulatedContent(path) {
    if (!path || path === '' || path === 'index.html') {
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sandboxed Preview - ${this.projectType}</title>
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
            .status { margin-top: 20px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔒 Sandboxed Preview</h1>
            <div class="badge">Project Type: ${this.projectType.toUpperCase()}</div>
            
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
            log(\`Worker ID: ${this.id}\`);
            log(\`Project Type: ${this.projectType}\`);
            log(\`Port: ${this.port}\`);
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
        console.log('Worker: ${this.id}');
        
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
    
    return `Simulated content for ${path}`;
  }

  async stop() {
    this.status = 'stopping';
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.process) {
      // In real implementation, kill the container/process
      this.process = null;
    }
    
    this.status = 'stopped';
    logger.info(`Worker ${this.id} stopped`);
  }
}