const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({
    log: [
      { level: "query", emit: "event" },
      { level: "error", emit: "event" },
      { level: "warn", emit: "event" },
    ],
  });
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: [
        { level: "query", emit: "event" },
        { level: "error", emit: "event" },
        { level: "warn", emit: "event" },
      ],
    });
  }
  prisma = global.prisma;
}

if (process.env.NODE_ENV === "development") {
  prisma.$on("query", (e) => {
    logger.debug(`Query: ${e.query}`);
    logger.debug(`Duration: ${e.duration}ms`);
  });
}

prisma.$on("error", (e) => logger.error("Prisma error:", e));
prisma.$on("warn", (e) => logger.warn("Prisma warning:", e));

// Test de conexión
const testConnection = async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Manejo de cierre graceful
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Database connection closed');
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  logger.info('Database connection closed (SIGINT)');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  logger.info('Database connection closed (SIGTERM)');
  process.exit(0);
});

// IMPORTANTE: Exportar ambos
module.exports = { prisma, testConnection };