const { prisma } = require('../config/database');
const logger = require('../utils/logger');

class AnalyticsService {
  /**
   * Obtener estadísticas de clicks por campaña
   * @param {string} campaignName - Nombre de la campaña
   * @param {Date} startDate - Fecha inicio
   * @param {Date} endDate - Fecha fin
   * @returns {Promise<Object>}
   */
  async getCampaignStats(campaignName, startDate, endDate) {
    try {
      const where = {
        utmCampaign: campaignName
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [totalClicks, successfulLeads, failedLeads, uniquePhones] = await Promise.all([
        // Total de clicks
        prisma.click.count({ where }),
        
        // Leads creados exitosamente
        prisma.click.count({
          where: { ...where, kommoStatus: 'success' }
        }),
        
        // Leads fallidos
        prisma.click.count({
          where: { ...where, kommoStatus: 'failed' }
        }),
        
        // Teléfonos únicos
        prisma.click.groupBy({
          by: ['phoneNumber'],
          where,
          _count: true
        })
      ]);

      return {
        campaign: campaignName,
        totalClicks,
        successfulLeads,
        failedLeads,
        uniquePhones: uniquePhones.length,
        conversionRate: totalClicks > 0 
          ? ((successfulLeads / totalClicks) * 100).toFixed(2) + '%'
          : '0%'
      };

    } catch (error) {
      logger.error('Error getting campaign stats:', error);
      throw error;
    }
  }

  /**
   * Obtener top campañas por clicks
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>}
   */
  async getTopCampaigns(limit = 10) {
    try {
      const campaigns = await prisma.click.groupBy({
        by: ['utmCampaign'],
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: limit,
        where: {
          utmCampaign: {
            not: null
          }
        }
      });

      return campaigns.map(c => ({
        campaign: c.utmCampaign,
        clicks: c._count.id
      }));

    } catch (error) {
      logger.error('Error getting top campaigns:', error);
      throw error;
    }
  }

  /**
   * Obtener clicks recientes
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>}
   */
  async getRecentClicks(limit = 20) {
    try {
      return await prisma.click.findMany({
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          phoneNumber: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          kommoStatus: true,
          createdAt: true
        }
      });

    } catch (error) {
      logger.error('Error getting recent clicks:', error);
      throw error;
    }
  }

  /**
   * Obtener resumen general
   * @returns {Promise<Object>}
   */
  async getDashboardSummary() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalClicks,
        todayClicks,
        totalLeads,
        activeCampaigns
      ] = await Promise.all([
        // Total de clicks
        prisma.click.count(),
        
        // Clicks de hoy
        prisma.click.count({
          where: {
            createdAt: {
              gte: today
            }
          }
        }),
        
        // Total de leads creados
        prisma.click.count({
          where: {
            kommoStatus: 'success'
          }
        }),
        
        // Campañas activas
        prisma.campaign.count({
          where: {
            isActive: true
          }
        })
      ]);

      return {
        totalClicks,
        todayClicks,
        totalLeads,
        activeCampaigns,
        conversionRate: totalClicks > 0
          ? ((totalLeads / totalClicks) * 100).toFixed(2) + '%'
          : '0%'
      };

    } catch (error) {
      logger.error('Error getting dashboard summary:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
