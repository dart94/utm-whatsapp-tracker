const express = require('express');
const router = express.Router();
const redirectController = require('../controllers/redirectController');
const { validateRedirect } = require('../middlewares/validator');
const { asyncHandler } = require('../middlewares/errorHandler');

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