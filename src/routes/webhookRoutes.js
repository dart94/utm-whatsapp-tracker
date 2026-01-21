const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

//webhook de kommo
router.post('/kommo', webhookController.kommoWebhook.bind(webhookController));

module.exports = router;