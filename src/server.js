import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { runRouter } from './routes/runs.js';
import { previewRouter } from './routes/preview.js';
import { errorHandler } from './middleware/error-handler.js';
import { securityMiddleware } from './middleware/security.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // We'll handle CSP per-route
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Upload rate limiting (stricter)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Only 10 uploads per 15 minutes
  message: 'Too many upload requests from this IP'
});

// CORS configuration
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Security middleware for different route groups
app.use('/api/runs', uploadLimiter, securityMiddleware.api);
app.use('/preview', securityMiddleware.preview);

// Routes
app.use('/api/runs', runRouter);
app.use('/preview', previewRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve host page for testing
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Zip Preview Pipeline</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .upload-area { border: 2px dashed #ccc; padding: 40px; text-align: center; margin: 20px 0; }
        .upload-area.dragover { border-color: #007bff; background: #f8f9fa; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        button:disabled { background: #6c757d; cursor: not-allowed; }
        .status { margin: 20px 0; padding: 10px; border-radius: 4px; }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .status.info { background: #d1ecf1; color: #0c5460; border: 1px solid #b8daff; }
        .preview-container { margin: 20px 0; border: 1px solid #ddd; }
        .preview-iframe { width: 100%; height: 500px; border: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Zip-to-Sandboxed-Preview Pipeline</h1>
        <p>Upload a ZIP file containing a web project to see it rendered in a secure, sandboxed preview.</p>
        
        <div class="upload-area" id="uploadArea">
          <p>Drop a ZIP file here or click to select</p>
          <input type="file" id="fileInput" accept=".zip" style="display: none;">
          <button onclick="document.getElementById('fileInput').click()">Select ZIP File</button>
        </div>
        
        <div id="status" class="status" style="display: none;"></div>
        <div id="previewContainer" class="preview-container" style="display: none;">
          <h3>Preview (Sandboxed)</h3>
          <iframe id="previewIframe" class="preview-iframe" sandbox="allow-scripts allow-forms" style="border: 1px solid #ddd;"></iframe>
        </div>
      </div>

      <script>
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const status = document.getElementById('status');
        const previewContainer = document.getElementById('previewContainer');
        const previewIframe = document.getElementById('previewIframe');

        // File upload handling
        fileInput.addEventListener('change', handleFile);
        
        uploadArea.addEventListener('dragover', (e) => {
          e.preventDefault();
          uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
          uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
          e.preventDefault();
          uploadArea.classList.remove('dragover');
          const files = e.dataTransfer.files;
          if (files.length > 0) {
            handleFile({ target: { files } });
          }
        });

        async function handleFile(e) {
          const file = e.target.files[0];
          if (!file) return;
          
          if (!file.name.endsWith('.zip')) {
            showStatus('Please select a ZIP file', 'error');
            return;
          }

          showStatus('Uploading and processing...', 'info');
          
          const formData = new FormData();
          formData.append('file', file);
          
          try {
            const response = await fetch('/api/runs', {
              method: 'POST',
              body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
              showStatus(\`Upload successful! Run ID: \${result.id}\`, 'success');
              pollRunStatus(result.id);
            } else {
              showStatus(\`Error: \${result.error}\`, 'error');
            }
          } catch (error) {
            showStatus(\`Upload failed: \${error.message}\`, 'error');
          }
        }

        async function pollRunStatus(runId) {
          const maxAttempts = 30;
          let attempts = 0;
          
          const poll = async () => {
            if (attempts >= maxAttempts) {
              showStatus('Timeout waiting for preview to be ready', 'error');
              return;
            }
            
            try {
              const response = await fetch(\`/api/runs/\${runId}\`);
              const run = await response.json();
              
              if (run.status === 'ready' && run.previewUrl) {
                showStatus('Preview ready!', 'success');
                showPreview(run.previewUrl);
              } else if (run.status === 'failed') {
                showStatus(\`Build failed: \${run.error || 'Unknown error'}\`, 'error');
              } else {
                showStatus(\`Status: \${run.status}\`, 'info');
                attempts++;
                setTimeout(poll, 1000);
              }
            } catch (error) {
              showStatus(\`Error checking status: \${error.message}\`, 'error');
            }
          };
          
          poll();
        }

        function showStatus(message, type) {
          status.textContent = message;
          status.className = \`status \${type}\`;
          status.style.display = 'block';
        }

        function showPreview(url) {
          previewIframe.src = url;
          previewContainer.style.display = 'block';
          
          // Add loading indicator
          previewIframe.onload = function() {
            console.log('Preview iframe loaded successfully');
          };
          
          previewIframe.onerror = function() {
            console.error('Preview iframe failed to load');
            showStatus('Failed to load preview', 'error');
          };
          
          // Listen for postMessage from iframe
          window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'sandbox-test') {
              console.log('Message from preview:', e.data);
              showStatus(\`Received message: \${e.data.message}\`, 'success');
            }
          });
        }
      </script>
    </body>
    </html>
  `);
});

// Error handling
app.use(errorHandler);

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});