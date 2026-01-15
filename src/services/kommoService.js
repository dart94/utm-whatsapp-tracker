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

      // Log con strings simples
      console.log("=== KOMMO CREATE LEAD START ===");
      console.log("Phone:", phoneNumber);
      console.log("UTM Source:", utmSource);
      console.log("UTM Medium:", utmMedium);
      console.log("UTM Campaign:", utmCampaign);
      console.log("UTM Content:", utmContent);
      console.log("UTM Term:", utmTerm);
      console.log("Field IDs:", JSON.stringify(fields));

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

      console.log("Create payload:", JSON.stringify(createPayload));

      const createResponse = await this._makeRequestWithRetry(() =>
        client.post("/leads", createPayload)
      );

      const leadId = createResponse.data._embedded?.leads?.[0]?.id;

      if (!leadId) {
        throw new Error("No lead ID returned from Kommo");
      }

      console.log("✅ Lead created, ID:", leadId);

      // PASO 2: Preparar custom fields para PATCH
      const customFields = [];

      if (fields.utmSource && utmSource) {
        const fieldId = parseInt(fields.utmSource, 10);
        console.log("Adding field:", fieldId, "=", utmSource);
        customFields.push({
          field_id: fieldId,
          values: [{ value: utmSource }],
        });
      }

      if (fields.utmMedium && utmMedium) {
        const fieldId = parseInt(fields.utmMedium, 10);
        console.log("Adding field:", fieldId, "=", utmMedium);
        customFields.push({
          field_id: fieldId,
          values: [{ value: utmMedium }],
        });
      }

      if (fields.utmCampaign && utmCampaign) {
        const fieldId = parseInt(fields.utmCampaign, 10);
        console.log("Adding field:", fieldId, "=", utmCampaign);
        customFields.push({
          field_id: fieldId,
          values: [{ value: utmCampaign }],
        });
      }

      if (fields.utmContent && utmContent) {
        const fieldId = parseInt(fields.utmContent, 10);
        console.log("Adding field:", fieldId, "=", utmContent);
        customFields.push({
          field_id: fieldId,
          values: [{ value: utmContent }],
        });
      }

      if (fields.utmTerm && utmTerm) {
        const fieldId = parseInt(fields.utmTerm, 10);
        console.log("Adding field:", fieldId, "=", utmTerm);
        customFields.push({
          field_id: fieldId,
          values: [{ value: utmTerm }],
        });
      }

      console.log("Total fields to update:", customFields.length);

      // PASO 3: Actualizar con PATCH si hay custom fields
      if (customFields.length > 0) {
        const updatePayload = {
          custom_fields_values: customFields,
        };

        console.log("PATCH URL:", `/leads/${leadId}`);
        console.log("PATCH payload:", JSON.stringify(updatePayload));

        try {
          await this._makeRequestWithRetry(() =>
            client.patch(`/leads/${leadId}`, updatePayload)
          );

          console.log("✅ PATCH successful");
        } catch (patchError) {
          console.log("❌ PATCH FAILED");
          console.log("Error message:", patchError.message);
          if (patchError.response) {
            console.log("Status:", patchError.response.status);
            console.log(
              "Error data:",
              JSON.stringify(patchError.response.data)
            );
          }
          throw patchError;
        }
      }

      logger.info("Lead created and updated successfully:", leadId);

      return {
        success: true,
        leadId: leadId.toString(),
        data: createResponse.data,
      };
    } catch (error) {
      console.log("=== ERROR CATCH BLOCK ===");
      console.log("Error message:", error.message);
      if (error.response) {
        console.log("Status code:", error.response.status);
        console.log("Error details:", JSON.stringify(error.response.data));
      }
      console.log("=== END ERROR ===");

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
