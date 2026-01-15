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

      logger.info("Kommo fields configuration:", fields);

      // Preparar custom fields - SOLO agregar si el field_id existe
      const customFields = [];

      if (fields.utmSource && utmSource) {
        const fieldId = parseInt(fields.utmSource, 10);
        if (!isNaN(fieldId)) {
          customFields.push({
            field_id: fieldId,
            values: [{ value: utmSource }],
          });
        }
      }

      if (fields.utmMedium && utmMedium) {
        const fieldId = parseInt(fields.utmMedium, 10);
        if (!isNaN(fieldId)) {
          customFields.push({
            field_id: fieldId,
            values: [{ value: utmMedium }],
          });
        }
      }

      if (fields.utmCampaign && utmCampaign) {
        const fieldId = parseInt(fields.utmCampaign, 10);
        if (!isNaN(fieldId)) {
          customFields.push({
            field_id: fieldId,
            values: [{ value: utmCampaign }],
          });
        }
      }

      if (fields.utmContent && utmContent) {
        const fieldId = parseInt(fields.utmContent, 10);
        if (!isNaN(fieldId)) {
          customFields.push({
            field_id: fieldId,
            values: [{ value: utmContent }],
          });
        }
      }

      if (fields.utmTerm && utmTerm) {
        const fieldId = parseInt(fields.utmTerm, 10);
        if (!isNaN(fieldId)) {
          customFields.push({
            field_id: fieldId,
            values: [{ value: utmTerm }],
          });
        }
      }

      logger.info("Custom fields to send:", customFields);

      // Preparar el payload del lead
      const payload = [
        {
          name: [`Lead de ${utmCampaign || "WhatsApp"}`], // ← Array en lugar de string
          custom_fields_values: customFields,
          _embedded: {
            contacts: [
              {
                custom_fields_values: [
                  {
                    field_code: "PHONE",
                    values: [{ value: phoneNumber, enum_code: "WORK" }],
                  },
                ],
              },
            ],
            tags: utmCampaign
              ? [
                  {
                    name: utmCampaign,
                  },
                ]
              : [],
          },
        },
      ];

      logger.info("Creating lead in Kommo:", { phoneNumber, utmCampaign });
      logger.debug("Full payload:", JSON.stringify(payload, null, 2));

      const response = await this._makeRequestWithRetry(() =>
        client.post("/leads", payload)
      );

      const leadId = response.data._embedded?.leads?.[0]?.id;

      logger.info("Lead created successfully in Kommo:", { leadId });

      return {
        success: true,
        leadId: leadId?.toString(),
        data: response.data,
      };
    } catch (error) {
      logger.error("Error creating lead in Kommo:", error.message);
      if (error.response) {
        logger.error(
          "Kommo error response:",
          JSON.stringify(error.response.data, null, 2)
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
