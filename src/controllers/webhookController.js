const { prisma } = require("../config/database");
const kommoService = require("../services/kommoService");
const logger = require("../utils/logger");
const { createResponse } = require("../utils/helpers");

class WebhookController {
  /**
   * Manejar webhook de Kommo cuando llega mensaje entrante
   */
  async handleKommoWebhook(req, res) {
    try {
      logger.info("=== KOMMO WEBHOOK RECEIVED ===");
      logger.info(JSON.stringify(req.body, null, 2));

      // El payload de "mensaje entrante" viene en este formato:
      const { message, account } = req.body;

      if (!message) {
        logger.warn("No message in webhook payload");
        return res.json({ success: true, message: "No message to process" });
      }

      const {
        contact_id,
        conversation_id,
        sender,
        created_at,
      } = message;

      logger.info(`New message from contact: ${contact_id}`);

      // Obtener info del contacto para sacar el número
      const contactInfo = await this._getContactInfo(contact_id);
      
      if (!contactInfo || !contactInfo.phoneNumber) {
        logger.warn(`No phone number found for contact ${contact_id}`);
        return res.json({ success: true });
      }

      logger.info(`Contact phone: ${contactInfo.phoneNumber}`);

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
        logger.warn(`No recent click found for contact ${contact_id}`);
        return res.json({ success: true });
      }

      logger.info(`Found matching click: ${recentClick.id}`);

      // Obtener el lead asociado al contacto
      const leadId = await this._getLeadFromContact(contact_id);

      if (!leadId) {
        logger.warn(`No lead found for contact ${contact_id}`);
        return res.json({ success: true });
      }

      logger.info(`Lead ID: ${leadId}`);

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

        logger.info(`✅ Lead ${leadId} updated with UTMs from click ${recentClick.id}`);
      }

      return res.json({ success: true });
    } catch (error) {
      logger.error("Error in Kommo webhook:", error);
      // Siempre responder 200 a Kommo para que no reintente
      return res.json({ success: false, error: error.message });
    }
  }

  /**
   * Obtener información del contacto
   */
  async _getContactInfo(contactId) {
    try {
      const kommoConfig = require("../config/kommo");
      const client = kommoConfig.getClient();

      const response = await client.get(`/contacts/${contactId}`);
      const contact = response.data;

      // Buscar el campo de teléfono
      const phoneField = contact.custom_fields_values?.find(
        (f) => f.field_code === "PHONE"
      );

      const phoneNumber = phoneField?.values?.[0]?.value;

      return {
        id: contact.id,
        name: contact.name,
        phoneNumber: phoneNumber,
      };
    } catch (error) {
      logger.error(`Error getting contact ${contactId}:`, error);
      return null;
    }
  }

  /**
   * Obtener lead asociado a un contacto
   */
  async _getLeadFromContact(contactId) {
    try {
      const kommoConfig = require("../config/kommo");
      const client = kommoConfig.getClient();

      // Buscar leads del contacto
      const response = await client.get("/leads", {
        params: {
          filter: {
            contact_id: contactId,
          },
          limit: 1,
          order: {
            created_at: "desc",
          },
        },
      });

      const leads = response.data._embedded?.leads;
      
      if (leads && leads.length > 0) {
        return leads[0].id;
      }

      return null;
    } catch (error) {
      logger.error(`Error getting lead for contact ${contactId}:`, error);
      return null;
    }
  }

  /**
   * Actualizar lead de Kommo con datos UTM
   */
  async _updateLeadWithUTMs(leadId, clickData) {
    try {
      const kommoConfig = require("../config/kommo");
      const client = kommoConfig.getClient();
      const fields = kommoConfig.getFields();

      const customFields = [];

      // Agregar todos los campos UTM
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

      // Actualizar el lead
      await client.patch(`/leads/${leadId}`, {
        custom_fields_values: customFields,
      });

      // Agregar tags si hay campaña
      if (clickData.utmCampaign) {
        await client.patch(`/leads/${leadId}`, {
          _embedded: {
            tags: [{ name: clickData.utmCampaign }],
          },
        });
        logger.info(`Added tag: ${clickData.utmCampaign}`);
      }

      logger.info(`✅ Lead ${leadId} updated successfully`);
      return true;
    } catch (error) {
      logger.error(`Error updating lead ${leadId}:`, error);
      if (error.response) {
        logger.error("Response data:", JSON.stringify(error.response.data));
      }
      return false;
    }
  }
}

module.exports = new WebhookController();