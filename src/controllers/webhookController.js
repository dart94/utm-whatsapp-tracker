const { prsima } = require("../config/database");
const kommoService = require("../services/kommoService");
const logger = require("../utils/logger");
const { createRespone } = require("../utils/helpers");

class WebhookController {
  /**
   * Manejar webhook de Kommo cuando llega nuevo mensaje
   */
  async handleKommoWebhook(req, res) {
    try {
      logger.info("Kommo webhook received:", JSON.stringify(req.body));

      const { leads } = req.body;

      if (!leads || !leads.add) {
        logger.warn("No leads.add in webhook");
        return res.json({ success: true, message: "No leads to process" });
      }

      // Procesar cada lead nuevo
      for (const leadData of leads.add) {
        const leadId = leadData.id;
        const createdAt = leadData.created_at;

        logger.info(`Processing new lead from webhook: ${leadId}`);

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

        if (recentClick) {
          logger.info(`Found matching click: ${recentClick.id}`);

          // Actualizar lead en Kommo con UTMs
          const success = await this._updateLeadWithUTMs(leadId, recentClick);

          if (success) {
            // Vincular click con lead
            await prisma.click.update({
              where: { id: recentClick.id },
              data: {
                kommoLeadId: leadId.toString(),
                kommoStatus: "success",
              },
            });

            logger.info(
              `✅ Lead ${leadId} updated with UTMs from click ${recentClick.id}`,
            );
          }
        } else {
          logger.warn(`No recent click found for lead ${leadId}`);
        }
      }

      return res.json({ success: true });
    } catch (error) {
      logger.error("Error in Kommo webhook:", error);
      // Siempre responder 200 a Kommo para que no reintente
      return res.json({ success: false, error: error.message });
    }
  }

  /**
   * Actualizar lead de kommo con datos UTM
   */

  async _updateLeadWithUTMs(leadId, click) {
    try {
      const kommoConfig = require("../config/kommo");
      const client = kommoConfig.getClient();
      const fields = kommoConfig.getFields();

      const customFields = [];

      //Agregar todos los campos UTM
      if (fields.utmSource) {
        customFields.push({
          field_id: parseInt(fields.utmSource, 10),
          values: [{ value: click.utmSource || "" }],
        });
      }

      if (fields.utmMedium) {
        customFields.push({
          field_id: parseInt(fields.utmMedium, 10),
          values: [{ value: click.utmMedium || "" }],
        });
      }

      if (fields.utmCampaign) {
        customFields.push({
          field_id: parseInt(fields.utmCampaign, 10),
          values: [{ value: click.utmCampaign || "" }],
        });
      }

      if (fields.utmContent) {
        customFields.push({
          field_id: parseInt(fields.utmContent, 10),
          values: [{ value: click.utmContent || "" }],
        });
      }

      if (fields.utmTerm) {
        customFields.push({
          field_id: parseInt(fields.utmTerm, 10),
          values: [{ value: click.utmTerm || "" }],
        });
      }

      if (fields.fbclid && clickData.fbclid) {
        customFields.push({
          field_id: parseInt(fields.fbclid, 10),
          values: [{ value: clickData.fbclid }],
        });
      }

      if (customFields.length === 0) {
        logger.info(`No UTM fields to update for lead ${leadId}`);
        return false;
      }

      logger.info(
        `Updating lead ${leadId} with UTM fields: ${JSON.stringify(customFields)}`,
      );

      // Actualizar lead en Kommo
      await client.patch(`/leads/${leadId}`, {
        custom_fields_values: customFields,
      });

      //Agregar tags si hay campaña
      if (clickData.utmCampaign) {
        await client.patch(`/leads/${leadId}`, {
          _embedded: {
            tags: [{ name: clickData.utmCampaign }],
          },
        });
      }

      logger.info(`Lead ${leadId} updated successfully in Kommo`);
      return true;
    } catch (error) {
      logger.error(`Error updating lead ${leadId} in Kommo:`, error);
      return false;
    }
  }
}

module.exports = new WebhookController();
