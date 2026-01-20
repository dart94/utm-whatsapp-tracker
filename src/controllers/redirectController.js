const { prisma } = require("../config/database");
const kommoService = require("../services/kommoService");
const logger = require("../utils/logger");
const fs = require("fs").promises;
const path = require("path");
const {
  sanitizePhone,
  sanitizeUtm,
  getClientIp,
  createResponse,
} = require("../utils/helpers");

// Rangos de IPs de Meta/Facebook
const META_IP_RANGES = [
  "173.252.",
  "69.171.",
  "31.13.",
  "66.220.",
  "157.240.",
  "204.15.",
  "69.63.",
];

// Función para detectar si es IP de Meta
const isMetaIP = (ip) => {
  if (!ip) return false;
  return META_IP_RANGES.some((range) => ip.startsWith(range));
};

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
    gclid,
  } = req.query;

  try {
    // Sanitizar datos
    const phoneNumber = sanitizePhone(phone);

    const cleanUtmParam = (value) => {
      if (!value) return null;
      if (value.includes("{{") || value.includes("}}")) {
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
      gclid: sanitizeUtm(gclid),
    };

    // Obtener metadata del request
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const referer = req.headers["referer"] || req.headers["referrer"];

    // Detectar si es IP de Meta
    const isMetaVerification = isMetaIP(ipAddress);

    // DEDUPLICACIÓN 1: Por IP + User Agent (5 minutos)
    // Esto previene loops y clicks accidentales
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    const recentClickSameUser = await prisma.click.findFirst({
      where: {
        ipAddress,
        userAgent,
        createdAt: {
          gte: fiveMinutesAgo,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (recentClickSameUser) {
      logger.info("Duplicate click from same user (within 5 min)", {
        ip: ipAddress,
        minutesAgo: Math.round((Date.now() - new Date(recentClickSameUser.createdAt).getTime()) / 60000)
      });

      // Mostrar página con botón (sin crear registro nuevo)
      const whatsappMessage = encodeURIComponent(
        `Hola! Vengo de la promoción ${utmData.utmCampaign || "en redes sociales"}`
      );
      const whatsappUrl = `${process.env.WHATSAPP_BASE_URL}/${phoneNumber}?text=${whatsappMessage}`;

      const htmlPath = path.join(__dirname, "../views/redirect.html");
      let html = await fs.readFile(htmlPath, "utf-8");

      html = html.replace("{{WHATSAPP_URL}}", whatsappUrl);
      html = html.replace("{{MESSAGE}}", "¡Hablemos!");
      html = html.replace("{{DESCRIPTION}}", "Toca el botón para abrir WhatsApp");

      return res.send(html);
    }

    // DEDUPLICACIÓN 2: Por FBCLID (si existe)
    // Cada fbclid es único por click de Meta
    if (fbclid) {
      const existingFbclid = await prisma.click.findFirst({
        where: {
          fbclid,
        },
      });

      if (existingFbclid) {
        logger.info("Duplicate FBCLID detected", { fbclid });

        const whatsappMessage = encodeURIComponent(
          `Hola! Vengo de la promoción ${utmData.utmCampaign || "en redes sociales"}`
        );
        const whatsappUrl = `${process.env.WHATSAPP_BASE_URL}/${phoneNumber}?text=${whatsappMessage}`;

        const htmlPath = path.join(__dirname, "../views/redirect.html");
        let html = await fs.readFile(htmlPath, "utf-8");

        html = html.replace("{{WHATSAPP_URL}}", whatsappUrl);
        html = html.replace("{{MESSAGE}}", "¡Hablemos!");
        html = html.replace("{{DESCRIPTION}}", "Toca el botón para abrir WhatsApp");

        return res.send(html);
      }
    }

    logger.info("Processing new redirect:", {
      phoneNumber,
      campaign: utmData.utmCampaign,
      source: utmData.utmSource,
      ip: ipAddress,
      isMetaVerification,
    });

    // SIEMPRE crear lead en Kommo (excepto si es IP de Meta)
    const shouldCreateKommoLead = !isMetaVerification;

    // Crear registro en BD
    const clickRecord = await prisma.click.create({
      data: {
        phoneNumber,
        ...utmData,
        ipAddress,
        userAgent,
        referer,
        kommoStatus: isMetaVerification ? "skipped" : "pending",
      },
    });

    // Crear lead en Kommo
    if (shouldCreateKommoLead) {
      logger.info("Creating Kommo lead for new user");
      this._createKommoLeadAsync(clickRecord.id, phoneNumber, utmData).catch(
        (error) => {
          logger.error("Background Kommo lead creation failed:", error);
        }
      );
    } else {
      logger.info("Meta verification - skipping Kommo");
    }

    // Construir URL de WhatsApp
    const whatsappMessage = encodeURIComponent(
      `Hola! Vengo de la promoción ${utmData.utmCampaign || "en redes sociales"}`
    );
    const whatsappUrl = `${process.env.WHATSAPP_BASE_URL}/${phoneNumber}?text=${whatsappMessage}`;

    logger.info("Showing redirect page:", { clickId: clickRecord.id });

    // Personalizar mensaje según campaña
    let pageMessage = "¡Hablemos!";
    let pageDescription = "Toca el botón para abrir WhatsApp y comenzar la conversación";

    if (utmData.utmCampaign) {
      if (utmData.utmCampaign.includes("promo")) {
        pageMessage = "¡Aprovecha la promoción!";
        pageDescription = "Toca el botón para consultar disponibilidad en WhatsApp";
      } else if (utmData.utmCampaign.includes("cotizacion")) {
        pageMessage = "¡Solicita tu cotización!";
        pageDescription = "Toca el botón para recibir tu cotización personalizada";
      }
    }

    // Leer y personalizar HTML
    const htmlPath = path.join(__dirname, "../views/redirect.html");
    let html = await fs.readFile(htmlPath, "utf-8");

    html = html.replace("{{WHATSAPP_URL}}", whatsappUrl);
    html = html.replace("{{MESSAGE}}", pageMessage);
    html = html.replace("{{DESCRIPTION}}", pageDescription);

    return res.send(html);
  } catch (error) {
    logger.error("Error in redirect handler:", error);

    const fallbackMessage = encodeURIComponent("Hola!");
    const fallbackUrl = `${process.env.WHATSAPP_BASE_URL}/${sanitizePhone(phone)}?text=${fallbackMessage}`;

    try {
      const htmlPath = path.join(__dirname, "../views/redirect.html");
      let html = await fs.readFile(htmlPath, "utf-8");
      html = html.replace("{{WHATSAPP_URL}}", fallbackUrl);
      html = html.replace("{{MESSAGE}}", "¡Hablemos!");
      html = html.replace("{{DESCRIPTION}}", "Toca el botón para abrir WhatsApp");
      return res.send(html);
    } catch (htmlError) {
      return res.redirect(301, fallbackUrl);
    }
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

      // Actualizar registro
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

      await this._createKommoLeadAsync(click.id, click.phoneNumber, {
        utmSource: click.utmSource,
        utmMedium: click.utmMedium,
        utmCampaign: click.utmCampaign,
        utmContent: click.utmContent,
        utmTerm: click.utmTerm,
        fbclid: click.fbclid,
        gclid: click.gclid,
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