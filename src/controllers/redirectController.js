const { prisma } = require("../config/database");
const kommoService = require("../services/kommoService");
const logger = require("../utils/logger");
const fs = require('fs').promises;
const path = require('path');
const {
  sanitizePhone,
  sanitizeUtm,
  getClientIp,
  createResponse,
} = require("../utils/helpers");

class RedirectController {
  /**
   * Manejar redirección a WhatsApp con tracking UTM
   */
  async handleRedirect(req, res) {
  const { phone } = req.params;
  const { 
    utm_source, 
    utm_medium, 
    utm_campaign, 
    utm_content, 
    utm_term,
    fbclid,
    gclid
  } = req.query;

  try {
    // Sanitizar datos
    const phoneNumber = sanitizePhone(phone);
    
    // Función helper para detectar parámetros no reemplazados
    const cleanUtmParam = (value) => {
      if (!value) return null;
      // Si contiene {{ }}, significa que Meta no lo reemplazó (preview/test)
      if (value.includes('{{') || value.includes('}}')) {
        return null;
      }
      return sanitizeUtm(value);
    };
    
    const utmData = {
      utmSource: cleanUtmParam(utm_source),
      utmMedium: cleanUtmParam(utm_medium),
      utmCampaign: cleanUtmParam(utm_campaign),
      utmContent: cleanUtmParam(utm_content),
      utmTerm: cleanUtmParam(utm_term),
      fbclid: sanitizeUtm(fbclid),
      gclid: sanitizeUtm(gclid)
    };

    // Obtener metadata del request
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];
    const referer = req.headers['referer'] || req.headers['referrer'];

    logger.info('Processing redirect:', {
      phoneNumber,
      campaign: utmData.utmCampaign,
      source: utmData.utmSource,
      fbclid: utmData.fbclid,
      ip: ipAddress
    });

    // Crear registro en base de datos
    const clickRecord = await prisma.click.create({
      data: {
        phoneNumber,
        ...utmData,
        ipAddress,
        userAgent,
        referer,
        kommoStatus: 'pending'
      }
    });

    // Intentar crear lead en Kommo (sin bloquear la redirección)
    this._createKommoLeadAsync(clickRecord.id, phoneNumber, utmData)
      .catch(error => {
        logger.error('Background Kommo lead creation failed:', error);
      });

    // Construir URL de WhatsApp
    const whatsappUrl = `${process.env.WHATSAPP_BASE_URL}/${phoneNumber}`;
    
    logger.info('Showing redirect page to WhatsApp:', { clickId: clickRecord.id, url: whatsappUrl });
    
    // Leer la landing page
    const htmlPath = path.join(__dirname, '../views/redirect.html');
    let html = await fs.readFile(htmlPath, 'utf-8');
    
    // Reemplazar la URL de WhatsApp
    html = html.replace('{{WHATSAPP_URL}}', whatsappUrl);
    
    // Agregar header para evitar cache
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Expires': '0',
      'Pragma': 'no-cache'
    });
    
    // Enviar la landing page
    return res.send(html);

  } catch (error) {
    logger.error('Error in redirect handler:', error);

    // Fallback: redirigir directamente si hay error
    const fallbackUrl = `${process.env.WHATSAPP_BASE_URL}/${sanitizePhone(phone)}`;
    return res.redirect(301, fallbackUrl);
  }
}

  /**
   * Crear lead en Kommo de forma asíncrona
   * @private
   */
  async _createKommoLeadAsync(clickId, phoneNumber, utmData) {
    try {
      const result = await kommoService.createLead({
        phoneNumber,
        ...utmData,
      });

      // Actualizar registro con resultado
      await prisma.click.update({
        where: { id: clickId },
        data: {
          kommoLeadId: result.leadId,
          kommoStatus: result.success ? "success" : "failed",
          kommoError: result.error || null,
        },
      });

      logger.info("Kommo lead creation completed:", {
        clickId,
        success: result.success,
        leadId: result.leadId,
      });
    } catch (error) {
      logger.error("Error in async Kommo lead creation:", error);

      // Actualizar como fallido
      await prisma.click.update({
        where: { id: clickId },
        data: {
          kommoStatus: "failed",
          kommoError: error.message,
        },
      });
    }
  }

  /**
   * Obtener información de un click específico
   */
  async getClickInfo(req, res) {
    const { id } = req.params;

    try {
      const click = await prisma.click.findUnique({
        where: { id },
      });

      if (!click) {
        return res.status(404).json(createResponse(false, "Click not found"));
      }

      return res.json(
        createResponse(true, "Click retrieved successfully", click)
      );
    } catch (error) {
      logger.error("Error getting click info:", error);
      throw error;
    }
  }

  /**
   * Obtener todos los clicks con filtros
   */
  async getAllClicks(req, res) {
    const { page = 1, limit = 20, campaign, source, status } = req.query;

    try {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const where = {};

      if (campaign) where.utmCampaign = campaign;
      if (source) where.utmSource = source;
      if (status) where.kommoStatus = status;

      const [clicks, total] = await Promise.all([
        prisma.click.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: "desc" },
        }),
        prisma.click.count({ where }),
      ]);

      return res.json(
        createResponse(true, "Clicks retrieved successfully", {
          clicks,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
          },
        })
      );
    } catch (error) {
      logger.error("Error getting clicks:", error);
      throw error;
    }
  }

  /**
   * Reintentar crear lead en Kommo para un click fallido
   */
  async retryKommoLead(req, res) {
    const { id } = req.params;

    try {
      const click = await prisma.click.findUnique({
        where: { id },
      });

      if (!click) {
        return res.status(404).json(createResponse(false, "Click not found"));
      }

      if (click.kommoStatus === "success") {
        return res
          .status(400)
          .json(createResponse(false, "Lead already created successfully"));
      }

      // Reintentar creación
      await this._createKommoLeadAsync(click.id, click.phoneNumber, {
        utmSource: click.utmSource,
        utmMedium: click.utmMedium,
        utmCampaign: click.utmCampaign,
        utmContent: click.utmContent,
        utmTerm: click.utmTerm,
        fbclid: click.fbclid,
        gclid: click.gclid
      });

      return res.json(
        createResponse(true, "Retry initiated for Kommo lead creation")
      );
    } catch (error) {
      logger.error("Error retrying Kommo lead:", error);
      throw error;
    }
  }
}

module.exports = new RedirectController();