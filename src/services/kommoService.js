const kommoConfig = require("../config/kommo");
const logger = require("../utils/logger");
const { sleep } = require("../utils/helpers");

class KommoService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 segundo
  }

  /**
   * Crear un lead en Kommo
   * @param {Object} leadData - Datos del lead
   * @returns {Promise<Object>}
   */
  async createLead(leadData) {
    if (!kommoConfig.isConfigured()) {
      logger.warn("Kommo not configured, skipping lead creation");
      return { success: false, error: "Kommo not configured" };
    }

    const {
      phoneNumber,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
    } = leadData;

    try {
      const client = kommoConfig.getClient();
      const fields = kommoConfig.getFields();

      logger.info("Lead data received:", {
        phoneNumber,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
      });
      logger.info("Kommo field IDs:", fields);

      // PASO 1: Crear el lead sin custom fields
      const createPayload = [
        {
          name: [`Lead de ${utmCampaign || "WhatsApp"}`],
          _embedded: {
            contacts: [
              {
                custom_fields_values: [
                  {
                    field_code: "PHONE",
                    values: [
                      {
                        value: phoneNumber,
                        enum_code: "WORK",
                      },
                    ],
                  },
                ],
              },
            ],
            tags: utmCampaign ? [{ name: utmCampaign }] : [],
          },
        },
      ];

      logger.info(
        "Creating lead with payload:",
        JSON.stringify(createPayload, null, 2)
      );

      const createResponse = await this._makeRequestWithRetry(() =>
        client.post("/leads", createPayload)
      );

      const leadId = createResponse.data._embedded?.leads?.[0]?.id;

      if (!leadId) {
        throw new Error("No lead ID returned from Kommo");
      }

      logger.info("✅ Lead created successfully, ID:", leadId);

      // PASO 2: Preparar custom fields para PATCH
      const customFields = [];

      if (fields.utmSource && utmSource) {
        const fieldId = parseInt(fields.utmSource, 10);
        logger.info(`Adding UTM Source: ${fieldId} = ${utmSource}`);
        customFields.push({
          field_id: fieldId,
          values: [{ value: utmSource }],
        });
      }

      if (fields.utmMedium && utmMedium) {
        const fieldId = parseInt(fields.utmMedium, 10);
        logger.info(`Adding UTM Medium: ${fieldId} = ${utmMedium}`);
        customFields.push({
          field_id: fieldId,
          values: [{ value: utmMedium }],
        });
      }

      if (fields.utmCampaign && utmCampaign) {
        const fieldId = parseInt(fields.utmCampaign, 10);
        logger.info(`Adding UTM Campaign: ${fieldId} = ${utmCampaign}`);
        customFields.push({
          field_id: fieldId,
          values: [{ value: utmCampaign }],
        });
      }

      if (fields.utmContent && utmContent) {
        const fieldId = parseInt(fields.utmContent, 10);
        logger.info(`Adding UTM Content: ${fieldId} = ${utmContent}`);
        customFields.push({
          field_id: fieldId,
          values: [{ value: utmContent }],
        });
      }

      if (fields.utmTerm && utmTerm) {
        const fieldId = parseInt(fields.utmTerm, 10);
        logger.info(`Adding UTM Term: ${fieldId} = ${utmTerm}`);
        customFields.push({
          field_id: fieldId,
          values: [{ value: utmTerm }],
        });
      }

      logger.info(`Total custom fields to add: ${customFields.length}`);

      // PASO 3: Actualizar con PATCH si hay custom fields
      if (customFields.length > 0) {
        const updatePayload = {
          custom_fields_values: customFields,
        };

        logger.info("PATCH payload:", JSON.stringify(updatePayload, null, 2));
        logger.info(`Updating lead ${leadId} with UTM fields...`);

        try {
          await this._makeRequestWithRetry(() =>
            client.patch(`/leads/${leadId}`, updatePayload)
          );

          logger.info("✅ Lead updated with UTM data successfully");
        } catch (patchError) {
          logger.error("❌ PATCH failed:", patchError.message);
          if (patchError.response) {
            logger.error("PATCH error status:", patchError.response.status);
            logger.error(
              "PATCH error data:",
              JSON.stringify(patchError.response.data, null, 2)
            );
          }
          throw patchError;
        }
      } else {
        logger.warn("No custom fields to update");
      }

      return {
        success: true,
        leadId: leadId.toString(),
        data: createResponse.data,
      };
    } catch (error) {
      logger.error("❌ Error in createLead:", error.message);
      if (error.response) {
        logger.error("Response status:", error.response.status);
        logger.error(
          "Response data:",
          JSON.stringify(error.response.data, null, 2)
        );
        logger.error(
          "Response headers:",
          JSON.stringify(error.response.headers, null, 2)
        );
      }

      return {
        success: false,
        error:
          error.response?.data?.detail || error.response?.data || error.message,
      };
    }
  }

  /**
   * Buscar leads por teléfono
   * @param {string} phoneNumber
   * @returns {Promise<Array>}
   */
  async findLeadsByPhone(phoneNumber) {
    if (!kommoConfig.isConfigured()) {
      return [];
    }

    try {
      const client = kommoConfig.getClient();

      const response = await client.get("/leads", {
        params: {
          query: phoneNumber,
          limit: 10,
        },
      });

      return response.data._embedded?.leads || [];
    } catch (error) {
      logger.error("Error finding leads by phone:", error.message);
      return [];
    }
  }

  /**
   * Actualizar un lead existente
   * @param {string} leadId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateLead(leadId, updates) {
    if (!kommoConfig.isConfigured()) {
      return { success: false, error: "Kommo not configured" };
    }

    try {
      const client = kommoConfig.getClient();

      const response = await this._makeRequestWithRetry(() =>
        client.patch(`/leads/${leadId}`, updates)
      );

      logger.info("Lead updated successfully:", { leadId });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error("Error updating lead:", error.message);

      return {
        success: false,
        error: error.response?.data?.detail || error.message,
      };
    }
  }

  /**
   * Hacer request con reintentos
   * @param {Function} requestFn
   * @returns {Promise}
   */
  async _makeRequestWithRetry(requestFn) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        // No reintentar en errores 4xx (excepto 429)
        if (
          error.response?.status >= 400 &&
          error.response?.status < 500 &&
          error.response?.status !== 429
        ) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          logger.warn(
            `Request failed, retrying (${attempt}/${this.maxRetries})...`
          );
          await sleep(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Verificar conexión con Kommo
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    if (!kommoConfig.isConfigured()) {
      return false;
    }

    try {
      const client = kommoConfig.getClient();
      await client.get("/account");
      logger.info("✅ Kommo connection successful");
      return true;
    } catch (error) {
      logger.error("❌ Kommo connection failed:", error.message);
      return false;
    }
  }
}

module.exports = new KommoService();
