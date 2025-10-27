/**
 * Azure Function pour échanger un token user via OBO
 * VERSION ULTRA-SIMPLIFIÉE pour debugging
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
        context.log('🔄 ===== DÉBUT ÉCHANGE TOKEN OBO =====');
        
        // 1. Vérifier les variables d'environnement
        context.log('📋 Variables d\'environnement:');
        context.log('   AZURE_CLIENT_ID:', process.env.AZURE_CLIENT_ID ? '✅ Présent' : '❌ MANQUANT');
        context.log('   AZURE_TENANT_ID:', process.env.AZURE_TENANT_ID ? '✅ Présent' : '❌ MANQUANT');
        context.log('   AZURE_CLIENT_SECRET:', process.env.AZURE_CLIENT_SECRET ? '✅ Présent' : '❌ MANQUANT');
        context.log('   POWER_PLATFORM_ENDPOINT:', process.env.POWER_PLATFORM_ENDPOINT ? '✅ Présent' : '❌ MANQUANT');
        
        if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_TENANT_ID || 
            !process.env.AZURE_CLIENT_SECRET || !process.env.POWER_PLATFORM_ENDPOINT) {
            throw new Error('Variables d\'environnement manquantes. Vérifiez la configuration dans Azure Static Web App.');
        }
        
        // 2. Récupérer le token utilisateur
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Token d\'authentification manquant dans Authorization header');
        }

        const userToken = authHeader.substring(7);
        context.log('✅ Token utilisateur reçu');
        context.log('   Longueur:', userToken.length);
        
        // 3. Décoder le token
        const tokenPayload = JSON.parse(
            Buffer.from(userToken.split('.')[1], 'base64').toString()
        );
        
        context.log('🔍 Token décodé:');
        context.log('   Audience (aud):', tokenPayload.aud);
        context.log('   Scopes (scp):', tokenPayload.scp);
        context.log('   Version (ver):', tokenPayload.ver);
        context.log('   Issuer (iss):', tokenPayload.iss);
        context.log('   Expire (exp):', new Date(tokenPayload.exp * 1000).toISOString());

        // 4. Validation d'audience TRÈS SIMPLE
        const clientId = process.env.AZURE_CLIENT_ID;
        const tokenAud = tokenPayload.aud;
        
        context.log('🎯 Validation d\'audience:');
        context.log('   Client ID attendu:', clientId);
        context.log('   Audience du token:', tokenAud);
        context.log('   Type audience:', typeof tokenAud);
        
        // Accepter si l'audience contient le client ID
        const audienceOk = tokenAud === clientId || 
                          tokenAud === `api://${clientId}` ||
                          (typeof tokenAud === 'string' && tokenAud.includes(clientId));
        
        if (!audienceOk) {
            context.log.error('❌ AUDIENCE INVALIDE !');
            context.log.error('   Le token n\'est pas destiné à cette API');
            context.log.error('   Vérifiez que:');
            context.log.error('   1. Le Client ID dans Azure Static Web App est correct');
            context.log.error('   2. Le frontend demande le bon scope');
            throw new Error(`Audience invalide: attendu ${clientId}, reçu ${tokenAud}`);
        }
        
        context.log('✅ Audience validée !');

        // 5. Configuration MSAL
        const confidentialClientConfig = {
            auth: {
                clientId: process.env.AZURE_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                clientSecret: process.env.AZURE_CLIENT_SECRET
            }
        };

        context.log('🔧 Configuration MSAL:');
        context.log('   Client ID:', process.env.AZURE_CLIENT_ID);
        context.log('   Tenant ID:', process.env.AZURE_TENANT_ID);
        context.log('   Authority:', confidentialClientConfig.auth.authority);

        const confidentialClient = new msal.ConfidentialClientApplication(confidentialClientConfig);
        context.log('✅ Client MSAL créé');

        // 6. Requête OBO
        const powerPlatformScope = `${process.env.POWER_PLATFORM_ENDPOINT}/.default`;
        
        const oboRequest = {
            oboAssertion: userToken,
            scopes: [powerPlatformScope],
            skipCache: false
        };

        context.log('🔄 Requête OBO:');
        context.log('   Scope demandé:', powerPlatformScope);
        context.log('   Skip cache:', oboRequest.skipCache);

        // 7. Acquérir le token
        context.log('⏳ Appel à acquireTokenOnBehalfOf...');
        
        const oboResponse = await confidentialClient.acquireTokenOnBehalfOf(oboRequest);
        
        if (!oboResponse || !oboResponse.accessToken) {
            throw new Error('Aucun token reçu de l\'échange OBO');
        }

        context.log('✅ ===== TOKEN POWER PLATFORM OBTENU ! =====');
        context.log('   Scopes obtenus:', oboResponse.scopes);
        context.log('   Expire à:', new Date(oboResponse.expiresOn).toISOString());
        context.log('   Longueur token:', oboResponse.accessToken.length);

        // 8. Retourner le token
        context.res.status = 200;
        context.res.body = {
            success: true,
            token: oboResponse.accessToken,
            expiresOn: oboResponse.expiresOn,
            scopes: oboResponse.scopes
        };

        context.log('✅ ===== FIN ÉCHANGE TOKEN OBO - SUCCÈS =====');

    } catch (error) {
        context.log.error('❌ ===== ERREUR ÉCHANGE TOKEN OBO =====');
        context.log.error('Type:', error.constructor.name);
        context.log.error('Message:', error.message);
        
        if (error.stack) {
            context.log.error('Stack:', error.stack);
        }
        
        // Détails supplémentaires pour les erreurs MSAL
        if (error.errorCode) {
            context.log.error('Code erreur:', error.errorCode);
        }
        if (error.errorMessage) {
            context.log.error('Message erreur:', error.errorMessage);
        }

        // Messages d'aide
        if (error.message && error.message.includes('AADSTS')) {
            const errorCode = error.message.match(/AADSTS\d+/)?.[0];
            context.log.error('💡 Code erreur Azure AD détecté:', errorCode);
            
            switch (errorCode) {
                case 'AADSTS50013':
                    context.log.error('   = Client secret invalide ou expiré');
                    context.log.error('   Solution: Vérifiez AZURE_CLIENT_SECRET');
                    break;
                case 'AADSTS65001':
                    context.log.error('   = Permissions API manquantes');
                    context.log.error('   Solution: Ajoutez les permissions Power Platform dans Azure AD');
                    break;
                case 'AADSTS700016':
                    context.log.error('   = Application non trouvée');
                    context.log.error('   Solution: Vérifiez AZURE_CLIENT_ID et AZURE_TENANT_ID');
                    break;
                case 'AADSTS5002730':
                    context.log.error('   = Mauvaise audience dans le token');
                    context.log.error('   Solution: Le frontend doit demander le bon scope');
                    break;
            }
        }

        context.res.status = error.statusCode || 500;
        context.res.body = {
            success: false,
            error: error.message,
            errorCode: error.errorCode || 'UNKNOWN_ERROR',
            timestamp: new Date().toISOString()
        };
    }
};
