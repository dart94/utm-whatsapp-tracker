const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { sanitizePhone, generateSlug, createResponse } = require('../utils/helpers');

class CampaignController {
  /**
   * Crear una nueva campaña
   */
  async createCampaign(req, res) {
    const { name, phoneNumber, description, defaultUtmSource, defaultUtmMedium } = req.body;

    try {
      const campaign = await prisma.campaign.create({
        data: {
          name,
          phoneNumber: sanitizePhone(phoneNumber),
          description,
          defaultUtmSource,
          defaultUtmMedium
        }
      });

      logger.info('Campaign created:', { id: campaign.id, name: campaign.name });

      return res.status(201).json(
        createResponse(true, 'Campaign created successfully', campaign)
      );

    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json(
          createResponse(false, 'Campaign with this name already exists')
        );
      }

      logger.error('Error creating campaign:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las campañas
   */
  async getAllCampaigns(req, res) {
    const { active } = req.query;

    try {
      const where = {};
      if (active !== undefined) {
        where.isActive = active === 'true';
      }

      const campaigns = await prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return res.json(
        createResponse(true, 'Campaigns retrieved successfully', campaigns)
      );

    } catch (error) {
      logger.error('Error getting campaigns:', error);
      throw error;
    }
  }

  /**
   * Obtener una campaña por ID
   */
  async getCampaignById(req, res) {
    const { id } = req.params;

    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id }
      });

      if (!campaign) {
        return res.status(404).json(
          createResponse(false, 'Campaign not found')
        );
      }

      // Obtener estadísticas de la campaña
      const clickCount = await prisma.click.count({
        where: { utmCampaign: campaign.name }
      });

      return res.json(
        createResponse(true, 'Campaign retrieved successfully', {
          ...campaign,
          stats: {
            totalClicks: clickCount
          }
        })
      );

    } catch (error) {
      logger.error('Error getting campaign:', error);
      throw error;
    }
  }

  /**
   * Actualizar una campaña
   */
  async updateCampaign(req, res) {
    const { id } = req.params;
    const updates = req.body;

    try {
      // Sanitizar teléfono si está presente
      if (updates.phoneNumber) {
        updates.phoneNumber = sanitizePhone(updates.phoneNumber);
      }

      const campaign = await prisma.campaign.update({
        where: { id },
        data: updates
      });

      logger.info('Campaign updated:', { id: campaign.id });

      return res.json(
        createResponse(true, 'Campaign updated successfully', campaign)
      );

    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json(
          createResponse(false, 'Campaign not found')
        );
      }

      logger.error('Error updating campaign:', error);
      throw error;
    }
  }

  /**
   * Eliminar una campaña
   */
  async deleteCampaign(req, res) {
    const { id } = req.params;

    try {
      await prisma.campaign.delete({
        where: { id }
      });

      logger.info('Campaign deleted:', { id });

      return res.json(
        createResponse(true, 'Campaign deleted successfully')
      );

    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json(
          createResponse(false, 'Campaign not found')
        );
      }

      logger.error('Error deleting campaign:', error);
      throw error;
    }
  }

  /**
   * Generar URL de tracking para una campaña
   */
  async generateTrackingUrl(req, res) {
    const { id } = req.params;
    const { utm_source, utm_medium, utm_campaign, utm_content, utm_term } = req.query;

    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id }
      });

      if (!campaign) {
        return res.status(404).json(
          createResponse(false, 'Campaign not found')
        );
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      let trackingUrl = `${baseUrl}/wa/${campaign.phoneNumber}`;

      const params = new URLSearchParams();
      
      if (utm_source || campaign.defaultUtmSource) {
        params.append('utm_source', utm_source || campaign.defaultUtmSource);
      }
      if (utm_medium || campaign.defaultUtmMedium) {
        params.append('utm_medium', utm_medium || campaign.defaultUtmMedium);
      }
      if (utm_campaign) {
        params.append('utm_campaign', utm_campaign);
      }
      if (utm_content) {
        params.append('utm_content', utm_content);
      }
      if (utm_term) {
        params.append('utm_term', utm_term);
      }

      if (params.toString()) {
        trackingUrl += '?' + params.toString();
      }

      return res.json(
        createResponse(true, 'Tracking URL generated successfully', {
          campaign: campaign.name,
          url: trackingUrl
        })
      );

    } catch (error) {
      logger.error('Error generating tracking URL:', error);
      throw error;
    }
  }
}

module.exports = new CampaignController();
