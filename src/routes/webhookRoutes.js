const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhookController");

// ✅ Sin .bind() porque ya es una instancia
router.post("/kommo", webhookController.handleKommoWebhook);

module.exports = router;