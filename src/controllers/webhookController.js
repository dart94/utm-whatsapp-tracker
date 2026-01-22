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

      const { message } = req.body;

      if (!message) {
        logger.warn("No message in webhook payload");
        return res.json({ success: true, message: "No message to process" });
      }

      const { contact_id } = message;

      logger.info(`New message from contact: ${contact_id}`);

      // Obtener info del contacto
      const contactInfo = await this.getContactInfo(contact_id);
      
      if (!contactInfo || !contactInfo.phoneNumber) {
        logger.warn(`No phone number found for contact ${contact_id}`);
        return res.json({ success: true });
      }

      logger.info(`Contact phone: ${contactInfo.phoneNumber}`);

      // Buscar click reciente
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

      // Obtener lead asociado
      const leadId = await this.getLeadFromContact(contact_id);

      if (!leadId) {
        logger.warn(`No lead found for contact ${contact_id}`);
        return res.json({ success: true });
      }

      logger.info(`Lead ID: ${leadId}`);

      // Actualizar lead con UTMs
      const success = await this.updateLeadWithUTMs(leadId, recentClick);

      if (success) {
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
      return res.json({ success: false, error: error.message });
    }
  };

  getContactInfo = async (contactId) => {
    try {
      const kommoConfig = require("../config/kommo");
      const client = kommoConfig.getClient();

      const response = await client.get(`/contacts/${contactId}`);
      const contact = response.data;

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
  };

  getLeadFromContact = async (contactId) => {
    try {
      const kommoConfig = require("../config/kommo");
      const client = kommoConfig.getClient();

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

      await client.patch(`/leads/${leadId}`, {
        custom_fields_values: customFields,
      });

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
  };
}

module.exports = new WebhookController();