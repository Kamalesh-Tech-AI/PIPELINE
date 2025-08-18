# Zip-to-Sandboxed-Preview Pipeline

A production-ready system for securely uploading, building, and previewing web projects in isolated, sandboxed environments.

## Features

- **Secure ZIP Upload**: Validates file types, sizes, and paths to prevent zip bombs and path traversal attacks
- **Project Detection**: Automatically detects React, Vue, Angular, Node.js, Python, and static HTML projects
- **Isolated Execution**: Simulates containerized builds with resource limits (ready for gVisor integration)
- **Security Hardening**: Implements strict CSP, iframe sandboxing, and comprehensive security headers
- **Real-time Status**: WebSocket-like polling for build and deployment status updates
- **Resource Management**: Automatic cleanup and lifecycle management for preview environments

## Architecture

### Components

1. **API/Orchestrator** (`src/routes/runs.js`)
   - Handles ZIP uploads with validation
   - Manages run lifecycle and status tracking
   - RESTful API with proper error handling

2. **Worker Manager** (`src/services/worker-manager.js`)
   - Simulates isolated container execution
   - Ready for Docker + gVisor integration
   - Resource monitoring and process management

3. **Project Analyzer** (`src/services/zip-processor.js`)
   - Detects project types and frameworks
   - Analyzes dependencies and build requirements
   - Security validation for extracted files

4. **Security Middleware** (`src/middleware/security.js`)
   - Strict CSP policies per project type
   - Cross-origin and framing protection
   - Header sanitization for untrusted content

5. **Preview Proxy** (`src/routes/preview.js`)
   - Serves sandboxed preview content
   - Applies security headers and CSP
   - Content type detection and proxying

## Security Model

### Multi-Layer Protection

1. **Upload Validation**
   - File type and size restrictions
   - ZIP bomb and path traversal prevention
   - Maximum file count limits

2. **Process Isolation** (Production)
   - gVisor runtime for syscall interposition
   - Resource limits (CPU, memory, network)
   - Temporary filesystem isolation

3. **Browser Sandboxing**
   - Strict iframe sandbox attributes
   - Content Security Policy enforcement
   - Cross-origin isolation

4. **Network Isolation**
   - Default-deny egress rules
   - Temporary internet access for builds only
   - Separate preview subdomain space

## Installation

```bash
npm install
```

## Development

```bash
# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Production start
npm start
```

## API Endpoints

### Upload Project
```bash
POST /api/runs
Content-Type: multipart/form-data

curl -X POST -F "file=@project.zip" http://localhost:3000/api/runs
```

### Get Run Status
```bash
GET /api/runs/:id

curl http://localhost:3000/api/runs/123e4567-e89b-12d3-a456-426614174000
```

### Preview Content
```bash
GET /preview/:runId

# Served with strict security headers and CSP
```

## Configuration

Edit `src/config/index.js` to customize:

- Upload limits and restrictions
- Worker resource limits
- Security policies (CSP templates)
- Domain configuration
- Cleanup intervals

## Production Deployment

### Docker + gVisor Setup

1. **Install gVisor runtime**
```bash
# Install runsc
curl -fsSL https://gvisor.dev/archive.key | sudo apt-key add -
sudo add-apt-repository "deb https://storage.googleapis.com/gvisor/releases release main"
sudo apt-get update && sudo apt-get install -y runsc

# Configure Docker runtime
sudo vim /etc/docker/daemon.json
{
  "runtimes": {
    "runsc": {
      "path": "/usr/bin/runsc"
    }
  }
}
sudo systemctl restart docker
```

2. **Container Configuration**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["npm", "start"]
```

3. **Run with gVisor**
```bash
docker run --runtime=runsc \
  --memory=512m \
  --cpus="0.5" \
  --network=none \
  -p 3000:3000 \
  zip-preview-pipeline
```

### Reverse Proxy (Nginx)

```nginx
upstream preview_backend {
    server 127.0.0.1:3000;
}

# Preview subdomain with strict security
server {
    listen 443 ssl http2;
    server_name ~^run-(?<run_id>[a-f0-9\-]+)\.preview\.example\.com$;

    # Security headers
    add_header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;

    location / {
        proxy_pass http://preview_backend/preview/$run_id;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Strip potentially dangerous headers
        proxy_set_header Cookie "";
        proxy_set_header Authorization "";
    }
}

# Main application
server {
    listen 443 ssl http2;
    server_name app.example.com;

    location /api/ {
        proxy_pass http://preview_backend;
    }
    
    location / {
        proxy_pass http://preview_backend;
    }
}
```

## Testing Security

The system includes built-in security tests in the preview content:

1. **Popup Blocking**: Tests `window.open()` restrictions
2. **Navigation Prevention**: Tests `window.top` access blocking  
3. **PostMessage**: Tests safe cross-frame communication
4. **Network Isolation**: Tests fetch/XHR restrictions

Visit the preview URL and click the test buttons to verify sandbox effectiveness.

## Monitoring

The system logs security events and provides metrics for:

- Upload attempts and validation failures
- Build success/failure rates
- Resource usage per worker
- Security policy violations
- Cleanup operations

## License

MIT - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure security tests pass
5. Submit a pull request

## Security Reporting

Report security vulnerabilities privately to security@example.com