/**
 * Azure Function pour échanger un token user via OBO
 * VERSION DEBUG - Sans vérification de signature (TEMPORAIRE)
 * 
 * ⚠️ IMPORTANT : Cette version est uniquement pour le debugging
 * Utilisez la version complète (index.js) en production
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
        context.log('🔄 ===== DÉBUT ÉCHANGE TOKEN OBO (MODE DEBUG) =====');
        context.log('⚠️  ATTENTION : Vérification de signature désactivée');
        
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
        
        // 3. DÉCODAGE SIMPLE (sans vérification de signature - DEBUG uniquement)
        context.log('🔍 === DÉCODAGE TOKEN (MODE DEBUG) ===');
        
        const tenantId = process.env.AZURE_TENANT_ID;
        const clientId = process.env.AZURE_CLIENT_ID;

        // Décoder le token (sans vérifier la signature)
        const parts = userToken.split('.');
        if (parts.length !== 3) {
            throw new Error('Token JWT invalide (format incorrect)');
        }

        const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        context.log('✅ Token décodé (signature NON vérifiée)');
        context.log('🔍 Contenu du token:');
        context.log('   Audience (aud):', decoded.aud);
        context.log('   Scopes (scp):', decoded.scp || decoded.roles);
        context.log('   Version (ver):', decoded.ver);
        context.log('   Issuer (iss):', decoded.iss);
        context.log('   Subject (sub):', decoded.sub);
        context.log('   App ID (appid):', decoded.appid);
        context.log('   Expire (exp):', new Date(decoded.exp * 1000).toISOString());
        context.log('   Issued at (iat):', new Date(decoded.iat * 1000).toISOString());

        // 4. Validation SOUPLE de l'audience (mode permissif pour debug)
        context.log('🎯 Validation de l\'audience (mode permissif):');
        
        const expectedAudiences = [
            `api://${clientId}`,
            clientId,
            decoded.appid // Tolérer aussi l'appid
        ];
        
        context.log('   Audiences acceptées:');
        expectedAudiences.forEach(aud => context.log('     -', aud));
        context.log('   Audience du token:', decoded.aud);
        
        const audienceOk = expectedAudiences.includes(decoded.aud) ||
                          (typeof decoded.aud === 'string' && 
                           (decoded.aud.includes(clientId) || decoded.aud.includes(decoded.appid)));
        
        if (!audienceOk) {
            context.log.warn('⚠️  AUDIENCE INHABITUELLE (mais acceptée en mode debug)');
            context.log.warn('   Audience reçue:', decoded.aud);
            context.log.warn('   En production, vérifiez que le frontend demande le bon scope');
        } else {
            context.log('✅ Audience validée !');
        }

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
            scopes: oboResponse.scopes,
            debugMode: true
        };

        context.log('✅ ===== FIN ÉCHANGE TOKEN OBO - SUCCÈS (MODE DEBUG) =====');

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

        // Messages d'aide selon le code d'erreur Azure AD
        if (error.message && error.message.includes('AADSTS')) {
            const errorCode = error.message.match(/AADSTS\d+/)?.[0];
            context.log.error('💡 Code erreur Azure AD détecté:', errorCode);
            
            switch (errorCode) {
                case 'AADSTS50013':
                    context.log.error('   = Client secret invalide ou expiré');
                    context.log.error('   Solution: Vérifiez AZURE_CLIENT_SECRET dans Azure Static Web App');
                    break;
                case 'AADSTS65001':
                    context.log.error('   = Permissions API manquantes');
                    context.log.error('   Solution: Ajoutez les permissions Power Platform dans Azure AD');
                    context.log.error('   Puis accordez le consentement administrateur');
                    break;
                case 'AADSTS700016':
                    context.log.error('   = Application non trouvée');
                    context.log.error('   Solution: Vérifiez AZURE_CLIENT_ID et AZURE_TENANT_ID');
                    break;
                case 'AADSTS50027':
                    context.log.error('   = Token JWT invalide');
                    context.log.error('   Solution: Le token fourni n\'est pas valide ou est malformé');
                    break;
            }
        }

        context.res.status = error.statusCode || 500;
        context.res.body = {
            success: false,
            error: error.message,
            errorCode: error.errorCode || error.name || 'UNKNOWN_ERROR',
            timestamp: new Date().toISOString(),
            debugMode: true
        };
    }
};
