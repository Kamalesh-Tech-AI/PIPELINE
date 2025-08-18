export const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  upload: {
    maxSize: 50 * 1024 * 1024, // 50MB max ZIP size
    allowedExtensions: ['.zip'],
    tempDir: './temp',
    maxFiles: 1000 // Max files in ZIP
  },
  
  worker: {
    buildTimeout: 300000, // 5 minutes
    runTimeout: 300000,   // 5 minutes idle timeout
    memoryLimit: '512m',
    cpuLimit: '0.5'
  },
  
  security: {
    previewDomain: 'localhost',
    hostDomain: 'localhost',
    csp: {
      strict: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
      relaxed: "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"
    }
  },
  
  cors: {
    allowedOrigins: ['http://localhost:3000', 'http://localhost:5173']
  },
  
  cleanup: {
    maxRunAge: 24 * 60 * 60 * 1000, // 24 hours
    cleanupInterval: 60 * 60 * 1000  // 1 hour
  }
};