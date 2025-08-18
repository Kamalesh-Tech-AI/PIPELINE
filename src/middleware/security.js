import { config } from '../config/index.js';

export const securityMiddleware = {
  // Security for API routes
  api: (req, res, next) => {
    // Basic security headers for API
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    
    next();
  },

  // Security for preview routes (stricter)
  preview: (req, res, next) => {
    // Strict security headers for preview content
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN', // Allow framing by same origin
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    });

    // Remove potentially dangerous headers from requests
    delete req.headers.cookie;
    delete req.headers.authorization;
    delete req.headers['x-forwarded-for'];
    
    next();
  }
};