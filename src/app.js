const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');


// Crear aplicación Express
const app = express();

// Middlewares globales
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Morgan logger - solo en desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Morgan para logs de producción
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// Log de requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  next();
});

// Montar rutas principales
app.use('/', routes);

/**
 * @openapi
 * /:
 *   get:
 *     tags: [Health]
 *     summary: Info básica de la API
 *     responses:
 *       200:
 *         description: Estado y endpoints disponibles
 */


// Ruta raíz - información de la API
app.get('/', (req, res) => {
  res.json({
    name: 'UTM WhatsApp Tracker API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      redirect: '/wa/:phone?utm_source=...&utm_campaign=...',
      campaigns: '/api/campaigns',
      clicks: '/api/clicks',
      analytics: '/api/analytics'
    },
    documentation: 'https://github.com/tu-repo/utm-whatsapp-tracker',
    timestamp: new Date().toISOString()
  });
});

// Swagger Docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (req, res) => res.json(swaggerSpec));


// Manejo de errores 404
app.use(notFoundHandler);

// Manejo de errores globales
app.use(errorHandler);

module.exports = app;