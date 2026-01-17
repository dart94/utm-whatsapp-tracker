// src/config/swagger.js
const swaggerJSDoc = require("swagger-jsdoc");

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "UTM WhatsApp Tracker API",
    version: "1.0.0",
    description: "API para tracking de clicks UTM/fbclid y analítica básica.",
  },
  servers: [
    { url: "http://localhost:3000", description: "Local" },
    { url: "https://utm-whatsapp-tracker-production.up.railway.app", description: "Production" },
  ],
tags: [
  { name: "Health", description: "Estado del servicio" },
  { name: "Redirect", description: "Redirecciones WhatsApp con tracking" },
  { name: "Clicks", description: "Consulta y gestión de clicks" },
  { name: "Campaigns", description: "Gestión de campañas" },
  { name: "Analytics", description: "Analítica y métricas" },
],

  components: {
    schemas: {
      Click: {
        type: "object",
        properties: {
          _id: { type: "string", example: "65a1b2c3d4e5f67890123456" },
          createdAt: { type: "string", format: "date-time", example: "2026-01-16T19:10:00.000Z" },
          phone: { type: "string", example: "5216621234567" },
          ipAddress: { type: "string", example: "173.252.107.116" },
          userAgent: { type: "string", example: "Mozilla/5.0 ..." },
          fbclid: { type: "string", nullable: true, example: "IwAR..." },
          utm_source: { type: "string", nullable: true, example: "facebook" },
          utm_campaign: { type: "string", nullable: true, example: "campaña_enero" },
          utm_medium: { type: "string", nullable: true, example: "cpc" },
          utm_content: { type: "string", nullable: true, example: "ad_01" },
          utm_term: { type: "string", nullable: true, example: "keyword" },
          kommo: {
            type: "object",
            nullable: true,
            properties: {
              leadId: { type: "string", nullable: true, example: "123456" },
              status: { type: "string", nullable: true, example: "created" },
              error: { type: "string", nullable: true, example: "timeout" },
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: false },
          message: { type: "string", example: "Not found" },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: ["./src/routes/*.js", "./src/controllers/*.js", "./src/app.js"],
};

module.exports = swaggerJSDoc(options);
