const express = require('express');
const router = express.Router();

// Importar rutas
const redirectRoutes = require('./redirectRoutes');
const clickRoutes = require('./clickRoutes');
const campaignRoutes = require('./campaignRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const webhookRoutes = require('./webhookRoutes');

// Montar ruta de webhook
router.use('/api/webhooks', webhookRoutes);

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check del servicio
 *     description: Verifica estado, uptime y entorno del backend.
 *     responses:
 *       200:
 *         description: Servicio activo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: "ok" }
 *                 timestamp: { type: string, example: "2026-01-16T22:10:00.000Z" }
 *                 uptime: { type: number, example: 12345 }
 *                 environment: { type: string, example: "production" }
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});


// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Montar rutas
router.use('/c', redirectRoutes);
router.use('/redirect', redirectRoutes);
router.use('/wa', redirectRoutes);
router.use('/api/clicks', clickRoutes);
router.use('/api/campaigns', campaignRoutes);
router.use('/api/analytics', analyticsRoutes);

module.exports = router;
