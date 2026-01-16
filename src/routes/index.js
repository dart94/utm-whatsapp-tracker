const express = require('express');
const router = express.Router();

// Importar rutas
const redirectRoutes = require('./redirectRoutes');
const clickRoutes = require('./clickRoutes');
const campaignRoutes = require('./campaignRoutes');
const analyticsRoutes = require('./analyticsRoutes');

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
router.use('/redirect', redirectRoutes);
router.use('/wa', redirectRoutes);
router.use('/api/clicks', clickRoutes);
router.use('/api/campaigns', campaignRoutes);
router.use('/api/analytics', analyticsRoutes);

module.exports = router;
