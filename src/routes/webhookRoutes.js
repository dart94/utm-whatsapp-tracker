const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhookController");

//
router.post("/kommo", webhookController.handleKommoWebhook);

module.exports = router;