/**
 * Sanitiza un número de teléfono
 * @param {string} phone - Número de teléfono
 * @returns {string} - Número limpio
 */
const sanitizePhone = (phone) => {
  if (!phone) return '';
  
  // Remover todo excepto números y el símbolo +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Si no tiene +, agregarlo
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
};

/**
 * Valida un número de teléfono
 * @param {string} phone - Número de teléfono
 * @returns {boolean}
 */
const isValidPhone = (phone) => {
  if (!phone) return false;
  
  const cleaned = sanitizePhone(phone);
  
  // Debe tener entre 10 y 15 dígitos (sin contar el +)
  const digitsOnly = cleaned.replace(/\+/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
};

/**
 * Sanitiza parámetros UTM
 * @param {string} value - Valor UTM
 * @returns {string} - Valor sanitizado
 */
const sanitizeUtm = (value) => {
  if (!value) return null;
  
  // Remover caracteres especiales peligrosos
  return value
    .trim()
    .replace(/[<>\"']/g, '')
    .substring(0, 200); // Límite de 200 caracteres
};

/**
 * Extrae IP del request
 * @param {object} req - Request de Express
 * @returns {string} - IP address
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

/**
 * Genera un slug único para campañas
 * @param {string} name - Nombre de la campaña
 * @returns {string} - Slug
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Valida si una URL es válida
 * @param {string} url - URL a validar
 * @returns {boolean}
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Crea un objeto de respuesta estándar
 * @param {boolean} success - Si la operación fue exitosa
 * @param {string} message - Mensaje descriptivo
 * @param {object} data - Datos opcionales
 * @returns {object}
 */
const createResponse = (success, message, data = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString(),
  };
  
  if (data) {
    response.data = data;
  }
  
  return response;
};

/**
 * Sleep/delay function para reintentos
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise}
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports = {
  sanitizePhone,
  isValidPhone,
  sanitizeUtm,
  getClientIp,
  generateSlug,
  isValidUrl,
  createResponse,
  sleep,
};
