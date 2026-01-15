const logger = require('../utils/logger');
const { createResponse } = require('../utils/helpers');

/**
 * Middleware para manejar errores 404
 */
const notFoundHandler = (req, res, next) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json(
    createResponse(
      false,
      `Route ${req.originalUrl} not found`
    )
  );
};

/**
 * Middleware para manejar errores globales
 */
const errorHandler = (err, req, res, next) => {
  // Log del error
  logger.error('Error Handler:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Errores de Prisma
  if (err.code && err.code.startsWith('P')) {
    return res.status(500).json(
      createResponse(
        false,
        'Database error occurred',
        process.env.NODE_ENV === 'development' ? { error: err.message } : null
      )
    );
  }

  // Errores de validación
  if (err.name === 'ValidationError') {
    return res.status(400).json(
      createResponse(
        false,
        'Validation error',
        { errors: err.errors }
      )
    );
  }

  // Errores de sintaxis JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json(
      createResponse(
        false,
        'Invalid JSON syntax'
      )
    );
  }

  // Error genérico
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json(
    createResponse(
      false,
      message,
      process.env.NODE_ENV === 'development' ? { stack: err.stack } : null
    )
  );
};

/**
 * Wrapper para funciones async en rutas
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncHandler
};