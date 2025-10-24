const msal = require('@azure/msal-node');

module.exports = async function (context, req) {
    context.log('🔑 Power Platform token exchange requested');
    context.log('Method:', req.method);
    context.log('Headers:', Object.keys(req.headers));

    // Gérer CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type'
            },
            body: ''
        };
        return;
    }

    // Vérifier les variables d'environnement
    const missingVars = [];
    if (!process.env.AZURE_CLIENT_ID) missingVars.push('AZURE_CLIENT_ID');
    if (!process.env.AZURE_TENANT_ID) missingVars.push('AZURE_TENANT_ID');
    if (!process.env.AZURE_CLIENT_SECRET) missingVars.push('AZURE_CLIENT_SECRET');
    if (!process.env.POWER_PLATFORM_ENDPOINT) missingVars.push('POWER_PLATFORM_ENDPOINT');

    if (missingVars.length > 0) {
        context.log.error('❌ Missing environment variables:', missingVars);
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: { 
                error: 'Configuration serveur incomplète',
                missing: missingVars
            }
        };
        return;
    }

    const userToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!userToken) {
        context.log.error('❌ No authorization header');
        context.res = {
            status: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: { error: 'Authorization header manquant' }
        };
        return;
    }

    try {
        context.log('📍 Creating MSAL client...');
        
        const msalConfig = {
            auth: {
                clientId: process.env.AZURE_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                clientSecret: process.env.AZURE_CLIENT_SECRET
            }
        };

        const cca = new msal.ConfidentialClientApplication(msalConfig);

        context.log('📍 Attempting OBO token exchange...');
        
        const oboRequest = {
            oboAssertion: userToken,
            scopes: [`${process.env.POWER_PLATFORM_ENDPOINT}/.default`]
        };

        context.log('   Scope:', oboRequest.scopes[0]);
        
        const response = await cca.acquireTokenOnBehalfOf(oboRequest);

        context.log('✅ Token exchange successful');
        
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                token: response.accessToken,
                expiresOn: response.expiresOn
            }
        };

    } catch (error) {
        context.log.error('❌ OBO failed:', error.message);
        context.log.error('Error code:', error.errorCode);
        context.log.error('Error details:', error.errorMessage);
        
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: { 
                error: error.message,
                errorCode: error.errorCode,
                errorMessage: error.errorMessage
            }
        };
    }
};