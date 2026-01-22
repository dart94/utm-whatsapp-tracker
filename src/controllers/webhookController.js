const { prisma } = require("../config/database");
const logger = require("../utils/logger");

class WebhookController {
  handleKommoWebhook = async (req, res) => {
    try {
      logger.info("=== KOMMO WEBHOOK RECEIVED ===");
      logger.info(JSON.stringify(req.body, null, 2));

      // Payload de "Lead agregado" tiene estructura diferente
      const { leads } = req.body;

      if (!leads || !leads.add || leads.add.length === 0) {
        logger.warn("No leads in webhook payload");
        return res.json({ success: true, message: "No leads to process" });
      }

      // Procesar cada lead nuevo
      for (const lead of leads.add) {
        const leadId = lead.id;
        const createdAt = lead.created_at;

        logger.info(`New lead created: ${leadId} at ${createdAt}`);

        // Buscar click reciente (últimos 5 minutos) sin lead asignado
        const fiveMinutesAgo = new Date(Date.now() - 300000);
        
        const recentClick = await prisma.click.findFirst({
          where: {
            kommoLeadId: null,
            kommoStatus: { in: ["pending", "tracked"] },
            createdAt: {
              gte: fiveMinutesAgo,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (!recentClick) {
          logger.info(`No recent click found for lead ${leadId} - organic lead`);
          continue; // Siguiente lead
        }

        // Verificar edad del click
        const clickAge = (Date.now() - new Date(recentClick.createdAt).getTime()) / 1000;
        logger.info(`Found click ${recentClick.id}, age: ${Math.round(clickAge)}s`);

        if (clickAge > 300) {
          logger.warn(`Click too old (${Math.round(clickAge)}s), skipping`);
          continue;
        }

        logger.info(`Matching lead ${leadId} with click ${recentClick.id}`);
        logger.info(`Campaign: ${recentClick.utmCampaign}`);

        // Actualizar lead con UTMs
        const success = await this.updateLeadWithUTMs(leadId, recentClick);

        if (success) {
          // Marcar click como vinculado
          await prisma.click.update({
            where: { id: recentClick.id },
            data: {
              kommoLeadId: leadId.toString(),
              kommoStatus: "success",
            },
          });

          logger.info(`✅ Lead ${leadId} successfully linked to click ${recentClick.id}`);
        } else {
          logger.error(`Failed to update lead ${leadId}`);
        }
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
        logger.info(`  • UTM Source: ${clickData.utmSource || "(empty)"}`);
      }

      if (fields.utmMedium) {
        customFields.push({
          field_id: parseInt(fields.utmMedium, 10),
          values: [{ value: clickData.utmMedium || "" }],
        });
        logger.info(`  • UTM Medium: ${clickData.utmMedium || "(empty)"}`);
      }

      if (fields.utmCampaign) {
        customFields.push({
          field_id: parseInt(fields.utmCampaign, 10),
          values: [{ value: clickData.utmCampaign || "" }],
        });
        logger.info(`  • UTM Campaign: ${clickData.utmCampaign || "(empty)"}`);
      }

      if (fields.utmContent) {
        customFields.push({
          field_id: parseInt(fields.utmContent, 10),
          values: [{ value: clickData.utmContent || "" }],
        });
        logger.info(`  • UTM Content: ${clickData.utmContent || "(empty)"}`);
      }

      if (fields.utmTerm) {
        customFields.push({
          field_id: parseInt(fields.utmTerm, 10),
          values: [{ value: clickData.utmTerm || "" }],
        });
        logger.info(`  • UTM Term: ${clickData.utmTerm || "(empty)"}`);
      }

      if (fields.fbclid && clickData.fbclid) {
        customFields.push({
          field_id: parseInt(fields.fbclid, 10),
          values: [{ value: clickData.fbclid }],
        });
        logger.info(`  • FBCLID: ${clickData.fbclid}`);
      }

      if (customFields.length === 0) {
        logger.warn("No custom fields to update");
        return false;
      }

      logger.info(`Updating lead ${leadId} with ${customFields.length} fields`);

      await client.patch(`/leads/${leadId}`, {
        custom_fields_values: customFields,
      });

      if (clickData.utmCampaign) {
        await client.patch(`/leads/${leadId}`, {
          _embedded: {
            tags: [{ name: clickData.utmCampaign }],
          },
        });
        logger.info(`  • Tag: ${clickData.utmCampaign}`);
      }

      return true;
    } catch (error) {
      logger.error(`Error updating lead ${leadId}:`, error);
      if (error.response) {
        logger.error("Status:", error.response.status);
        logger.error("Data:", JSON.stringify(error.response.data));
      }
      return false;
    }
  };
}

module.exports = new WebhookController();