const express = require('express');
const router = express.Router();
const redirectController = require('../controllers/redirectController');
const { validateRedirect } = require('../middlewares/validator');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * @openapi
 * /wa/{phone}:
 *   get:
 *     tags: [Redirect]
 *     summary: Redirección WhatsApp con tracking UTM
 *     description: >
 *       Registra un click (utm, fbclid, ip, user-agent) y redirige a WhatsApp.
 *       Este endpoint recibe tráfico real y tráfico automático (Meta).
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema: { type: string, example: "5216621234567" }
 *       - in: query
 *         name: utm_source
 *         schema: { type: string, example: "facebook" }
 *       - in: query
 *         name: utm_campaign
 *         schema: { type: string, example: "enero_2026" }
 *       - in: query
 *         name: fbclid
 *         schema: { type: string, example: "IwAR..." }
 *     responses:
 *       302:
 *         description: Redirección a WhatsApp
 */


/**
 * @route   GET /wa/:phone
 * @desc    Redirigir a WhatsApp con tracking UTM
 * @access  Public
 */
router.get(
  '/:phone',
  validateRedirect,
  asyncHandler(redirectController.handleRedirect.bind(redirectController))
);

module.exports = router;