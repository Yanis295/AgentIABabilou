/**
 * Azure Function pour échanger un token user via OBO (On-Behalf-Of)
 * VERSION CORRIGÉE - Accepte les deux formats d'audience
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
        
        // 2. Décoder le token pour vérifier (sans validation complète)
        const tokenPayload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
        context.log('🔍 Token info:', {
            audience: tokenPayload.aud,
            scopes: tokenPayload.scp,
            issuer: tokenPayload.iss,
            version: tokenPayload.ver
        });

        // 3. Validation de l'audience - ACCEPTER LES DEUX FORMATS
        const clientId = process.env.AZURE_CLIENT_ID;
        
        // L'audience peut être soit juste le Client ID, soit avec le préfixe api://
        const tokenAudience = Array.isArray(tokenPayload.aud) 
            ? tokenPayload.aud[0] 
            : tokenPayload.aud;
        
        // Vérifier si l'audience correspond à notre Client ID (avec ou sans préfixe)
        const audienceValid = 
            tokenAudience === clientId || 
            tokenAudience === `api://${clientId}` ||
            (typeof tokenAudience === 'string' && tokenAudience.includes(clientId));
        
        if (!audienceValid) {
            context.log.error('❌ Audience invalide !');
            context.log.error('   Client ID:', clientId);
            context.log.error('   Token audience:', tokenAudience);
            context.log.error('   Formats acceptés:');
            context.log.error('     - ' + clientId);
            context.log.error('     - api://' + clientId);
            throw new Error('Token avec une audience incorrecte');
        }
        
        context.log('✅ Audience validée:', tokenAudience);

        // 4. Configuration MSAL pour OBO
        const confidentialClientConfig = {
            auth: {
                clientId: process.env.AZURE_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                clientSecret: process.env.AZURE_CLIENT_SECRET
            }
        };

        const confidentialClient = new msal.ConfidentialClientApplication(confidentialClientConfig);
        context.log('✅ Client MSAL configuré');

        // 5. Préparer la requête OBO
        const oboRequest = {
            oboAssertion: userToken,
            scopes: [`${process.env.POWER_PLATFORM_ENDPOINT}/.default`],
            skipCache: false
        };

        context.log('📍 Échange OBO en cours...');
        context.log('   Target scope:', oboRequest.scopes[0]);

        // 6. Acquérir le token via OBO
        const oboResponse = await confidentialClient.acquireTokenOnBehalfOf(oboRequest);
        
        if (!oboResponse || !oboResponse.accessToken) {
            throw new Error('Aucun token reçu de l\'échange OBO');
        }

        context.log('✅ Token Power Platform obtenu via OBO');
        context.log(`   Scopes: ${oboResponse.scopes.join(', ')}`);
        context.log(`   Expire: ${new Date(oboResponse.expiresOn).toLocaleString()}`);

        // 7. Retourner le token
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

        // Messages d'aide selon l'erreur
        if (error.message && error.message.includes('AADSTS50013')) {
            context.log.error('💡 AADSTS50013 = Client secret invalide ou expiré');
            context.log.error('   Vérifiez AZURE_CLIENT_SECRET dans les variables d\'environnement');
        } else if (error.message && error.message.includes('AADSTS65001')) {
            context.log.error('💡 AADSTS65001 = Permissions API manquantes');
            context.log.error('   Ajoutez les permissions Power Platform dans Azure AD');
        } else if (error.message && error.message.includes('AADSTS700016')) {
            context.log.error('💡 AADSTS700016 = Application non trouvée');
            context.log.error('   Vérifiez AZURE_CLIENT_ID dans les variables d\'environnement');
        }

        context.res.status = error.statusCode || 500;
        context.res.body = {
            error: error.message,
            errorCode: error.errorCode || 'UNKNOWN_ERROR',
            timestamp: new Date().toISOString()
        };
    }
};
