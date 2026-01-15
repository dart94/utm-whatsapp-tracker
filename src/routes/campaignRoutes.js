const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { 
  validateCreateCampaign, 
  validateUpdateCampaign 
} = require('../middlewares/validator');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * @route   GET /api/campaigns
 * @desc    Obtener todas las campañas
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(campaignController.getAllCampaigns.bind(campaignController))
);

/**
 * @route   POST /api/campaigns
 * @desc    Crear una nueva campaña
 * @access  Public
 */
router.post(
  '/',
  validateCreateCampaign,
  asyncHandler(campaignController.createCampaign.bind(campaignController))
);

/**
 * @route   GET /api/campaigns/:id
 * @desc    Obtener una campaña por ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(campaignController.getCampaignById.bind(campaignController))
);

/**
 * @route   PUT /api/campaigns/:id
 * @desc    Actualizar una campaña
 * @access  Public
 */
router.put(
  '/:id',
  validateUpdateCampaign,
  asyncHandler(campaignController.updateCampaign.bind(campaignController))
);

/**
 * @route   DELETE /api/campaigns/:id
 * @desc    Eliminar una campaña
 * @access  Public
 */
router.delete(
  '/:id',
  asyncHandler(campaignController.deleteCampaign.bind(campaignController))
);

/**
 * @route   GET /api/campaigns/:id/tracking-url
 * @desc    Generar URL de tracking para una campaña
 * @access  Public
 */
router.get(
  '/:id/tracking-url',
  asyncHandler(campaignController.generateTrackingUrl.bind(campaignController))
);

module.exports = router;