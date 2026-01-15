require('dotenv').config();
const app = require('./src/app');
const { testConnection } = require('./src/config/database');
const kommoService = require('./src/services/kommoService');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;

// Función para iniciar el servidor
async function startServer() {
  try {
    // Verificar conexión a la base de datos
    logger.info('🔌 Connecting to database...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      logger.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Verificar conexión a Kommo (opcional)
    logger.info('🔌 Testing Kommo connection...');
    await kommoService.testConnection();

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📡 API: http://localhost:${PORT}`);
      logger.info(`💚 Health check: http://localhost:${PORT}/health`);
      
      if (process.env.NODE_ENV === 'development') {
        logger.info(`📊 Prisma Studio: Run 'npm run prisma:studio'`);
      }
    });

    // Manejo de errores del servidor
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} is already in use`);
      } else {
        logger.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    // Manejo de señales para shutdown graceful
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('✅ HTTP server closed');
        
        // Aquí se desconectará Prisma automáticamente por el evento beforeExit
        logger.info('👋 Server shutdown complete');
        process.exit(0);
      });

      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        logger.error('⚠️ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Manejo de excepciones no capturadas
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Iniciar servidor
startServer();