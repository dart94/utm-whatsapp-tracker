const express = require('express');
const router = express.Router();
const redirectController = require('../controllers/redirectController');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * @route   GET /api/clicks
 * @desc    Obtener todos los clicks con filtros
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(redirectController.getAllClicks.bind(redirectController))
);

/**
 * @route   GET /api/clicks/:id
 * @desc    Obtener información de un click específico
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(redirectController.getClickInfo.bind(redirectController))
);

/**
 * @route   POST /api/clicks/:id/retry
 * @desc    Reintentar crear lead en Kommo
 * @access  Public
 */
router.post(
  '/:id/retry',
  asyncHandler(redirectController.retryKommoLead.bind(redirectController))
);

module.exports = router;