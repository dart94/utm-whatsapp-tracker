# UTM WhatsApp Tracker

Sistema profesional de tracking UTM para WhatsApp con integración a Kommo CRM.

## 🚀 Características

- ✅ Redirección automática a WhatsApp con tracking UTM
- ✅ Integración con Kommo CRM
- ✅ Gestión de campañas
- ✅ Analytics y estadísticas
- ✅ Base de datos PostgreSQL con Prisma
- ✅ API REST completa
- ✅ Logs estructurados con Winston

## 📋 Requisitos

- Node.js >= 18.0.0
- PostgreSQL >= 13
- npm o yarn

## ⚙️ Instalación

1. Clonar el repositorio
2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus valores
```

4. Ejecutar migraciones:
```bash
npm run prisma:migrate
```

5. Iniciar servidor:
```bash
npm run dev
```

## 🛠️ Scripts Disponibles

- `npm start` - Iniciar en producción
- `npm run dev` - Iniciar en desarrollo con nodemon
- `npm run prisma:generate` - Generar cliente de Prisma
- `npm run prisma:migrate` - Ejecutar migraciones
- `npm run prisma:studio` - Abrir Prisma Studio

## 📡 Endpoints

### Redirección
- `GET /wa/:phone` - Redirigir a WhatsApp con UTMs

### Campañas
- `GET /api/campaigns` - Listar campañas
- `POST /api/campaigns` - Crear campaña
- `GET /api/campaigns/:id` - Obtener campaña
- `PUT /api/campaigns/:id` - Actualizar campaña
- `DELETE /api/campaigns/:id` - Eliminar campaña

### Clicks
- `GET /api/clicks` - Listar clicks
- `GET /api/clicks/:id` - Obtener click
- `POST /api/clicks/:id/retry` - Reintentar Kommo

### Analytics
- `GET /api/analytics/dashboard` - Resumen general
- `GET /api/analytics/campaigns/top` - Top campañas
- `GET /api/analytics/campaigns/:name/stats` - Estadísticas

## 🔗 Ejemplo de Uso
```
https://tudominio.com/wa/521234567890?utm_source=facebook&utm_medium=cpc&utm_campaign=spring_sale
```

## 📝 Licencia

MIT
```

### ✅ Verifica tu estructura completa:
```
utm-whatsapp-tracker/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── app.js
├── prisma/
├── node_modules/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js