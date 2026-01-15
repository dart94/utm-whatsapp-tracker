const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

class KommoConfig {
  constructor() {
    this.domain = process.env.KOMMO_DOMAIN;
    this.accessToken = process.env.KOMMO_ACCESS_TOKEN;
    this.baseURL = this.domain ? `https://${this.domain}/api/v4` : null;
    
    this.fields = {
      utmSource: process.env.KOMMO_FIELD_UTM_SOURCE,
      utmMedium: process.env.KOMMO_FIELD_UTM_MEDIUM,
      utmCampaign: process.env.KOMMO_FIELD_UTM_CAMPAIGN,
      utmContent: process.env.KOMMO_FIELD_UTM_CONTENT,
      utmTerm: process.env.KOMMO_FIELD_UTM_TERM
    };

    // Solo crear el cliente si está configurado
    if (this.isConfigured()) {
      this.client = this._createClient();
    } else {
      logger.warn('⚠️ Kommo not configured. Set KOMMO_DOMAIN and KOMMO_ACCESS_TOKEN');
    }
  }

  _createClient() {
    const client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    this._setupInterceptors(client);
    return client;
  }

  _setupInterceptors(client) {
    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        logger.debug(`Kommo Request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Kommo Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => {
        logger.debug(`Kommo Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        if (error.response) {
          const { status, data } = error.response;
          logger.error(`Kommo Error ${status}:`, data);

          if (status === 401) {
            logger.error('❌ Kommo authentication failed. Check your access token.');
          } else if (status === 429) {
            logger.warn('⚠️ Kommo rate limit exceeded. Retry later.');
          }
        } else if (error.request) {
          logger.error('Kommo no response received:', error.message);
        } else {
          logger.error('Kommo request setup error:', error.message);
        }
        
        return Promise.reject(error);
      }
    );
  }

  getClient() {
    if (!this.client) {
      throw new Error('Kommo client not initialized. Check configuration.');
    }
    return this.client;
  }

  isConfigured() {
    return !!(this.domain && this.accessToken);
  }

  getFields() {
    return this.fields;
  }
}

// Exportar instancia singleton
const kommoConfig = new KommoConfig();

module.exports = kommoConfig;
