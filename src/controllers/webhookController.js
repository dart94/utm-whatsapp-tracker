const { prisma } = require("../config/database");
const logger = require("../utils/logger");

class WebhookController {
  /**
   * Manejar webhook de Kommo cuando llega mensaje entrante
   */
  handleKommoWebhook = async (req, res) => {
    try {
      logger.info("=== KOMMO WEBHOOK RECEIVED ===");
      logger.info(JSON.stringify(req.body, null, 2));

      // El payload tiene un array message.add con los mensajes
      const { message } = req.body;

      if (!message || !message.add || message.add.length === 0) {
        logger.warn("No messages in webhook payload");
        return res.json({ success: true, message: "No messages to process" });
      }

      // Obtener el primer mensaje
      const firstMessage = message.add[0];
      const { contact_id, element_id, entity_id } = firstMessage;

      if (!contact_id) {
        logger.warn("No contact_id in message");
        return res.json({ success: true });
      }

      logger.info(`New message from contact: ${contact_id}`);

      // El lead ID viene en element_id o entity_id
      const leadId = element_id || entity_id;

      if (!leadId) {
        logger.warn(`No lead ID found in message`);
        return res.json({ success: true });
      }

      logger.info(`Lead ID from webhook: ${leadId}`);

      // Buscar click reciente (últimos 15 minutos) sin lead asignado
      const fifteenMinutesAgo = new Date(Date.now() - 900000);
      
      const recentClick = await prisma.click.findFirst({
        where: {
          kommoLeadId: null,
          kommoStatus: { in: ["pending", "tracked"] },
          createdAt: {
            gte: fifteenMinutesAgo,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!recentClick) {
        logger.warn(`No recent click found (last 15 min)`);
        logger.info(`This is OK if user didn't click ad before messaging`);
        return res.json({ success: true });
      }

      logger.info(`Found matching click: ${recentClick.id}`);
      logger.info(`Click campaign: ${recentClick.utmCampaign}`);
      logger.info(`Click fbclid: ${recentClick.fbclid}`);

      // Actualizar lead en Kommo con UTMs
      const success = await this.updateLeadWithUTMs(leadId, recentClick);

      if (success) {
        // Vincular click con lead
        await prisma.click.update({
          where: { id: recentClick.id },
          data: {
            kommoLeadId: leadId.toString(),
            kommoStatus: "success",
          },
        });

        logger.info(`✅ SUCCESS! Lead ${leadId} updated with UTMs from click ${recentClick.id}`);
      } else {
        logger.error(`Failed to update lead ${leadId} with UTMs`);
      }

      return res.json({ success: true });
    } catch (error) {
      logger.error("Error in Kommo webhook:", error);
      return res.json({ success: false, error: error.message });
    }
  };

  updateLeadWithUTMs = async (leadId, clickData) => {
    try {
      const kommoConfig = require("../config/kommo");
      const client = kommoConfig.getClient();
      const fields = kommoConfig.getFields();

      const customFields = [];

      if (fields.utmSource) {
        customFields.push({
          field_id: parseInt(fields.utmSource, 10),
          values: [{ value: clickData.utmSource || "" }],
        });
        logger.info(`Adding UTM Source: ${clickData.utmSource || "(empty)"}`);
      }

      if (fields.utmMedium) {
        customFields.push({
          field_id: parseInt(fields.utmMedium, 10),
          values: [{ value: clickData.utmMedium || "" }],
        });
        logger.info(`Adding UTM Medium: ${clickData.utmMedium || "(empty)"}`);
      }

      if (fields.utmCampaign) {
        customFields.push({
          field_id: parseInt(fields.utmCampaign, 10),
          values: [{ value: clickData.utmCampaign || "" }],
        });
        logger.info(`Adding UTM Campaign: ${clickData.utmCampaign || "(empty)"}`);
      }

      if (fields.utmContent) {
        customFields.push({
          field_id: parseInt(fields.utmContent, 10),
          values: [{ value: clickData.utmContent || "" }],
        });
        logger.info(`Adding UTM Content: ${clickData.utmContent || "(empty)"}`);
      }

      if (fields.utmTerm) {
        customFields.push({
          field_id: parseInt(fields.utmTerm, 10),
          values: [{ value: clickData.utmTerm || "" }],
        });
        logger.info(`Adding UTM Term: ${clickData.utmTerm || "(empty)"}`);
      }

      if (fields.fbclid && clickData.fbclid) {
        customFields.push({
          field_id: parseInt(fields.fbclid, 10),
          values: [{ value: clickData.fbclid }],
        });
        logger.info(`Adding FBCLID: ${clickData.fbclid}`);
      }

      if (customFields.length === 0) {
        logger.warn("No custom fields to update");
        return false;
      }

      logger.info(`Updating lead ${leadId} with ${customFields.length} custom fields`);

      // Actualizar campos custom
      await client.patch(`/leads/${leadId}`, {
        custom_fields_values: customFields,
      });

      logger.info(`✅ Custom fields updated on lead ${leadId}`);

      // Agregar tag si hay campaña
      if (clickData.utmCampaign) {
        await client.patch(`/leads/${leadId}`, {
          _embedded: {
            tags: [{ name: clickData.utmCampaign }],
          },
        });
        logger.info(`✅ Tag added: ${clickData.utmCampaign}`);
      }

      logger.info(`✅ Lead ${leadId} fully updated`);
      return true;
    } catch (error) {
      logger.error(`Error updating lead ${leadId}:`, error);
      if (error.response) {
        logger.error("Response status:", error.response.status);
        logger.error("Response data:", JSON.stringify(error.response.data));
      }
      return false;
    }
  };
}

module.exports = new WebhookController();