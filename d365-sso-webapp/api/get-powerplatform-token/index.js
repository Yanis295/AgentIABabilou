/**
 * Azure Function pour échanger un token user via OBO (On-Behalf-Of)
 * pour obtenir un token Power Platform
 */

const msal = require('@azure/msal-node');

module.exports = async function (context, req) {
    // CORS headers
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    };

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        context.log('🔄 === DÉBUT ÉCHANGE TOKEN OBO ===');
        
        // 1. Récupérer le token utilisateur depuis l'en-tête Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Token d\'authentification manquant');
        }

        const userToken = authHeader.substring(7); // Enlever "Bearer "
        context.log('✅ Token utilisateur reçu');
        
        // Debug: Décoder le token pour vérifier
        const tokenPayload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
        context.log('🔍 Token info:', {
            audience: tokenPayload.aud,
            scopes: tokenPayload.scp,
            issuer: tokenPayload.iss
        });

        // Vérification critique de l'audience
        if (!tokenPayload.aud || !tokenPayload.aud.includes(process.env.AZURE_CLIENT_ID)) {
            context.log.error('❌ ERREUR: Mauvaise audience dans le token');
            context.log.error('   Attendue:', `api://${process.env.AZURE_CLIENT_ID}`);
            context.log.error('   Reçue:', tokenPayload.aud);
            throw new Error('Token avec une audience incorrecte. Le token doit être destiné à cette API.');
        }

        // 2. Configuration MSAL pour OBO
        const confidentialClientConfig = {
            auth: {
                clientId: process.env.AZURE_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                clientSecret: process.env.AZURE_CLIENT_SECRET
            }
        };

        const confidentialClient = new msal.ConfidentialClientApplication(confidentialClientConfig);
        context.log('✅ Client MSAL configuré');

        // 3. Préparer la requête OBO
        const oboRequest = {
            oboAssertion: userToken,
            scopes: [`${process.env.POWER_PLATFORM_ENDPOINT}/.default`],
            skipCache: false // Utiliser le cache si possible
        };

        context.log('📍 Échange OBO en cours...');
        context.log('   Target scope:', oboRequest.scopes[0]);

        // 4. Acquérir le token via OBO
        const oboResponse = await confidentialClient.acquireTokenOnBehalfOf(oboRequest);
        
        if (!oboResponse || !oboResponse.accessToken) {
            throw new Error('Aucun token reçu de l\'échange OBO');
        }

        context.log('✅ Token Power Platform obtenu via OBO');
        context.log(`   Expire: ${new Date(oboResponse.expiresOn).toLocaleString()}`);

        // 5. Retourner le token
        context.res.status = 200;
        context.res.body = {
            token: oboResponse.accessToken,
            expiresOn: oboResponse.expiresOn,
            scopes: oboResponse.scopes
        };

        context.log('✅ === FIN ÉCHANGE TOKEN OBO - SUCCÈS ===');

    } catch (error) {
        context.log.error('❌ === ERREUR ÉCHANGE TOKEN OBO ===');
        context.log.error('Message:', error.message);
        context.log.error('Stack:', error.stack);

        // Erreurs spécifiques avec aide
        if (error.message.includes('AADSTS50013')) {
            context.log.error('💡 AADSTS50013 = Client secret invalide ou expiré');
        } else if (error.message.includes('AADSTS65001')) {
            context.log.error('💡 AADSTS65001 = Permissions API manquantes dans Azure AD');
        } else if (error.message.includes('AADSTS5002730')) {
            context.log.error('💡 AADSTS5002730 = Token avec mauvaise audience');
            context.log.error('   Le token frontend doit demander: api://[CLIENT_ID]/access_as_user');
        }

        context.res.status = error.statusCode || 500;
        context.res.body = {
            error: error.message,
            errorCode: error.errorCode,
            details: error.errorMessage,
            timestamp: new Date().toISOString()
        };
    }
};