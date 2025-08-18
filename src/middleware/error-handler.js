import { logger } from '../utils/logger.js';

export function errorHandler(error, req, res, next) {
  logger.error('Request error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Multer errors (file upload)
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      maxSize: '50MB'
    });
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field'
    });
  }

  if (error.message && error.message.includes('Only ZIP files')) {
    return res.status(400).json({
      error: 'Only ZIP files are allowed'
    });
  }

  // Rate limiting errors
  if (error.status === 429) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: error.headers['Retry-After']
    });
  }

  // Default error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    error: isDevelopment ? error.message : 'Internal server error',
    ...(isDevelopment && { stack: error.stack })
  });
}