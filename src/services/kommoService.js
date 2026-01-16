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

      console.log("=== KOMMO CREATE LEAD START ===");
      console.log("Phone:", phoneNumber);
      console.log("Campaign:", utmCampaign);

      // PASO 1: Crear el lead SIMPLE (sin contacto embedded)
      const createPayload = [
        {
          name: `Lead de ${utmCampaign || "WhatsApp"}`, // ← String simple, NO array
          // NO incluir contacto aquí, lo agregaremos después
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

      // PASO 2: Crear o buscar el contacto
      console.log("Creating/finding contact with phone:", phoneNumber);

      // Buscar si el contacto ya existe
      let contactId;
      try {
        const searchResponse = await client.get("/contacts", {
          params: {
            query: phoneNumber,
            limit: 1,
          },
        });

        const existingContact = searchResponse.data._embedded?.contacts?.[0];

        if (existingContact) {
          contactId = existingContact.id;
          console.log("✅ Contact found, ID:", contactId);
        }
      } catch (searchError) {
        console.log("Contact search failed or not found");
      }

      // Si no existe, crear el contacto
      if (!contactId) {
        console.log("Creating new contact...");
        const contactPayload = [
          {
            name: `Contact ${phoneNumber}`,
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
        ];

        const contactResponse = await this._makeRequestWithRetry(() =>
          client.post("/contacts", contactPayload)
        );

        contactId = contactResponse.data._embedded?.contacts?.[0]?.id;
        console.log("✅ Contact created, ID:", contactId);
      }

      // PASO 3: Vincular contacto al lead
      if (contactId) {
        console.log("Linking contact to lead...");
        const linkPayload = [
          {
            id: leadId,
            _embedded: {
              contacts: [
                {
                  id: contactId,
                },
              ],
            },
          },
        ];

        await this._makeRequestWithRetry(() =>
          client.patch("/leads", linkPayload)
        );

        console.log("✅ Contact linked to lead");
      }

      // PASO 4: Agregar tags si hay campaña
      if (utmCampaign) {
        console.log("Adding tags...");
        const tagPayload = [
          {
            id: leadId,
            _embedded: {
              tags: [
                {
                  name: utmCampaign,
                },
              ],
            },
          },
        ];

        await this._makeRequestWithRetry(() =>
          client.patch("/leads", tagPayload)
        );

        console.log("✅ Tags added");
      }

      // PASO 5: Preparar y agregar custom fields UTM
      const customFields = [];

      if (fields.utmSource && utmSource) {
        customFields.push({
          field_id: parseInt(fields.utmSource, 10),
          values: [{ value: utmSource }],
        });
      }

      if (fields.utmMedium && utmMedium) {
        customFields.push({
          field_id: parseInt(fields.utmMedium, 10),
          values: [{ value: utmMedium }],
        });
      }

      if (fields.utmCampaign && utmCampaign) {
        customFields.push({
          field_id: parseInt(fields.utmCampaign, 10),
          values: [{ value: utmCampaign }],
        });
      }

      if (fields.utmContent && utmContent) {
        customFields.push({
          field_id: parseInt(fields.utmContent, 10),
          values: [{ value: utmContent }],
        });
      }

      if (fields.utmTerm && utmTerm) {
        customFields.push({
          field_id: parseInt(fields.utmTerm, 10),
          values: [{ value: utmTerm }],
        });
      }

      if (fields.fbclid && leadData.fbclid) {
        const fieldId = parseInt(fields.fbclid, 10);
        console.log("Adding FBCLID:", fieldId, "=", leadData.fbclid);
        customFields.push({
          field_id: fieldId,
          values: [{ value: leadData.fbclid }],
        });
      }

      console.log("Total custom fields:", customFields.length);

      if (customFields.length > 0) {
        const updatePayload = {
          custom_fields_values: customFields,
        };

        console.log("Updating lead with UTM fields...");

        await this._makeRequestWithRetry(() =>
          client.patch(`/leads/${leadId}`, updatePayload)
        );

        console.log("✅ UTM fields updated");
      }

      console.log("=== KOMMO CREATE LEAD SUCCESS ===");

      return {
        success: true,
        leadId: leadId.toString(),
        data: createResponse.data,
      };
    } catch (error) {
      console.log("=== ERROR CATCH BLOCK ===");
      console.log("Error:", error.message);
      if (error.response) {
        console.log("Status:", error.response.status);
        console.log("Details:", JSON.stringify(error.response.data));
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
