/**
 * Azure Function pour le health check
 *
 * Cette fonction vérifie que l'application est en ligne
 */

module.exports = async function (context, req) {
    context.log('Health check endpoint called');

    const response = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'd365-sso-webapp',
        environment: process.env.AZURE_FUNCTIONS_ENVIRONMENT || 'production'
    };

    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: response
    };
};
