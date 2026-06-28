module.exports = {
  apps: [
    {
      name: 'meetingnote-backend',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',

        // Server
        PORT: 3001,

        // Database
        MONGODB_URI: 'your-mongodb-uri',

        // Auth
        JWT_SECRET: 'your-jwt-secret',

        // AI — OpenRouter
        OPENROUTE_API_KEY: 'sk-or-v1-...',

        // Transcription — Deepgram
        DEEPGRAM_API_KEY: 'your-deepgram-api-key',

        // Billing — Polar
        POLAR_TOKEN: 'polar_oat_...',
        POLAR_SECRET: 'polar_whs_...',
        POLAR_PRODUCT_STARTER: 'your-polar-product-id-starter',
        POLAR_PRODUCT_PRO: 'your-polar-product-id-pro',
        POLAR_PRODUCT_POWER: 'your-polar-product-id-power',
        POLAR_SANDBOX: 'false',

        // Frontend base URL (used in Polar checkout redirect)
        FRONTEND_URL: 'https://yourdomain.com',

        // RapidAPI
        RAPIDAPI_KEY: 'your-rapidapi-key',

        // Firebase — paste the service account JSON as a single-line string
        FIREBASE_SERVICE_ACCOUNT: '{"type":"service_account","project_id":"..."}',
      }
    }
  ]
}
