const { body, param, query, validationResult } = require('express-validator');
const { createResponse, isValidPhone } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Middleware para manejar errores de validación
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', errors.array());
    
    return res.status(400).json(
      createResponse(
        false,
        'Validation failed',
        { errors: errors.array() }
      )
    );
  }
  
  next();
};

/**
 * Validación para redirección a WhatsApp
 */
const validateRedirect = [
  param('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .custom((value) => {
      if (!isValidPhone(value)) {
        throw new Error('Invalid phone number format');
      }
      return true;
    }),
  
  query('utm_source')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('utm_source must be less than 100 characters'),
  
  query('utm_medium')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('utm_medium must be less than 100 characters'),
  
  query('utm_campaign')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('utm_campaign must be less than 100 characters'),
  
  query('utm_content')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('utm_content must be less than 200 characters'),
  
  query('utm_term')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('utm_term must be less than 200 characters'),
  
  handleValidationErrors
];

/**
 * Validación para crear campaña
 */
const validateCreateCampaign = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Campaign name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Campaign name must be between 3 and 100 characters'),
  
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .custom((value) => {
      if (!isValidPhone(value)) {
        throw new Error('Invalid phone number format');
      }
      return true;
    }),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('defaultUtmSource')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Default UTM source must be less than 100 characters'),
  
  body('defaultUtmMedium')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Default UTM medium must be less than 100 characters'),
  
  handleValidationErrors
];

/**
 * Validación para actualizar campaña
 */
const validateUpdateCampaign = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('Campaign ID is required'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Campaign name must be between 3 and 100 characters'),
  
  body('phoneNumber')
    .optional()
    .trim()
    .custom((value) => {
      if (value && !isValidPhone(value)) {
        throw new Error('Invalid phone number format');
      }
      return true;
    }),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  handleValidationErrors
];

/**
 * Validación para queries de analytics
 */
const validateAnalyticsQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO8601 date'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100'),
  
  handleValidationErrors
];

module.exports = {
  validateRedirect,
  validateCreateCampaign,
  validateUpdateCampaign,
  validateAnalyticsQuery,
  handleValidationErrors
};
