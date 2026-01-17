const express = require('express');
const router = express.Router();
const redirectController = require('../controllers/redirectController');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * @openapi
 * /api/clicks:
 *   get:
 *     tags: [Clicks]
 *     summary: Obtener todos los clicks (con filtros)
 *     description: Devuelve clicks almacenados. Permite filtrar por límites/ventana si lo soporta el controller.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 100 }
 *         description: Máximo de registros a devolver
 *       - in: query
 *         name: after
 *         schema: { type: string, format: date-time, example: "2026-01-16T18:00:00.000Z" }
 *         description: (Opcional) Solo clicks posteriores a esta fecha (si tu controller lo soporta)
 *     responses:
 *       200:
 *         description: Lista de clicks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     clicks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Click'
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/',
  asyncHandler(redirectController.getAllClicks.bind(redirectController))
);

/**
 * @openapi
 * /api/clicks/{id}:
 *   get:
 *     tags: [Clicks]
 *     summary: Obtener información de un click específico
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "65a1b2c3d4e5f67890123456" }
 *     responses:
 *       200:
 *         description: Click encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/Click'
 *       404:
 *         description: No encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:id',
  asyncHandler(redirectController.getClickInfo.bind(redirectController))
);

/**
 * @openapi
 * /api/clicks/{id}/retry:
 *   post:
 *     tags: [Clicks]
 *     summary: Reintentar crear lead en Kommo para un click
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "65a1b2c3d4e5f67890123456" }
 *     responses:
 *       200:
 *         description: Reintento ejecutado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 message: { type: string, example: "Retry executed" }
 *       404:
 *         description: Click no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:id/retry',
  asyncHandler(redirectController.retryKommoLead.bind(redirectController))
);

module.exports = router;
