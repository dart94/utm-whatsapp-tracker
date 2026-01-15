const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');
const { validateAnalyticsQuery } = require('../middlewares/validator');
const { asyncHandler } = require('../middlewares/errorHandler');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Obtener resumen del dashboard
 * @access  Public
 */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const summary = await analyticsService.getDashboardSummary();
    res.json(createResponse(true, 'Dashboard summary retrieved', summary));
  })
);

/**
 * @route   GET /api/analytics/campaigns/top
 * @desc    Obtener top campañas por clicks
 * @access  Public
 */
router.get(
  '/campaigns/top',
  validateAnalyticsQuery,
  asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const campaigns = await analyticsService.getTopCampaigns(parseInt(limit));
    res.json(createResponse(true, 'Top campaigns retrieved', campaigns));
  })
);

/**
 * @route   GET /api/analytics/campaigns/:name/stats
 * @desc    Obtener estadísticas de una campaña específica
 * @access  Public
 */
router.get(
  '/campaigns/:name/stats',
  validateAnalyticsQuery,
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const { startDate, endDate } = req.query;
    
    const stats = await analyticsService.getCampaignStats(
      name,
      startDate,
      endDate
    );
    
    res.json(createResponse(true, 'Campaign stats retrieved', stats));
  })
);

/**
 * @route   GET /api/analytics/clicks/recent
 * @desc    Obtener clicks recientes
 * @access  Public
 */
router.get(
  '/clicks/recent',
  validateAnalyticsQuery,
  asyncHandler(async (req, res) => {
    const { limit = 20 } = req.query;
    const clicks = await analyticsService.getRecentClicks(parseInt(limit));
    res.json(createResponse(true, 'Recent clicks retrieved', clicks));
  })
);

module.exports = router;