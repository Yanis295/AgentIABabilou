const msal = require('@azure/msal-node');

module.exports = async function (context, req) {
    context.log('Power Platform token exchange requested');

    const userToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!userToken) {
        context.res = {
            status: 401,
            body: { error: "Authorization header manquant" }
        };
        return;
    }

    try {
        // Configuration MSAL
        const msalConfig = {
            auth: {
                clientId: process.env.AZURE_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                clientSecret: process.env.AZURE_CLIENT_SECRET
            }
        };

        const cca = new msal.ConfidentialClientApplication(msalConfig);

        // Échange On-Behalf-Of
        const oboRequest = {
            oboAssertion: userToken,
            scopes: [`${process.env.POWER_PLATFORM_ENDPOINT}/.default`]
        };

        context.log('Attempting OBO token exchange...');
        const response = await cca.acquireTokenOnBehalfOf(oboRequest);

        context.log('Token exchange successful');
        
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                token: response.accessToken,
                expiresOn: response.expiresOn
            }
        };

    } catch (error) {
        context.log.error('OBO token exchange failed:', error);
        
        context.res = {
            status: 500,
            body: { 
                error: error.message,
                errorCode: error.errorCode,
                errorMessage: error.errorMessage
            }
        };
    }
};