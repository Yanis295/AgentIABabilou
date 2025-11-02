/**
 * Azure Function ULTRA-SIMPLIFIÉE pour diagnostic
 * Version minimale pour identifier le problème
 */

const msal = require('@azure/msal-node');

module.exports = async function (context, req) {
    // CORS
    context.res = {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    };

    if (req.method === 'OPTIONS') {
        context.res.status = 200;
        return;
    }

    try {
        context.log('🚀 === DÉBUT DIAGNOSTIC ===');
        
        // 1. Vérifier variables d'environnement
        const hasClientId = !!process.env.AZURE_CLIENT_ID;
        const hasTenantId = !!process.env.AZURE_TENANT_ID;
        const hasSecret = !!process.env.AZURE_CLIENT_SECRET;
        const hasPowerPlatform = !!process.env.POWER_PLATFORM_ENDPOINT;
        
        context.log('Variables env:', {
            AZURE_CLIENT_ID: hasClientId,
            AZURE_TENANT_ID: hasTenantId,
            AZURE_CLIENT_SECRET: hasSecret,
            POWER_PLATFORM_ENDPOINT: hasPowerPlatform
        });
        
        if (!hasClientId || !hasTenantId || !hasSecret || !hasPowerPlatform) {
            throw new Error('Variables d\'environnement manquantes');
        }
        
        // 2. Récupérer le token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Token manquant');
        }
        
        const userToken = authHeader.substring(7);
        context.log('✅ Token reçu, longueur:', userToken.length);
        
        // 3. Décoder le token (simple, sans vérification)
        const parts = userToken.split('.');
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        context.log('Token info:', {
            aud: decoded.aud,
            iss: decoded.iss,
            appid: decoded.appid,
            scp: decoded.scp
        });
        
        // 4. Configuration MSAL
        const config = {
            auth: {
                clientId: process.env.AZURE_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                clientSecret: process.env.AZURE_CLIENT_SECRET
            }
        };
        
        context.log('✅ Config MSAL créée');
        
        const client = new msal.ConfidentialClientApplication(config);
        context.log('✅ Client MSAL créé');
        
        // 5. Requête OBO
        const scope = `${process.env.POWER_PLATFORM_ENDPOINT}/.default`;
        context.log('Scope demandé:', scope);
        
        const oboRequest = {
            oboAssertion: userToken,
            scopes: [scope],
            skipCache: false
        };
        
        context.log('⏳ Appel OBO...');
        const oboResponse = await client.acquireTokenOnBehalfOf(oboRequest);
        
        if (!oboResponse || !oboResponse.accessToken) {
            throw new Error('Pas de token OBO reçu');
        }
        
        context.log('✅ Token OBO obtenu !');
        context.log('Scopes:', oboResponse.scopes);
        
        // Retour
        context.res.status = 200;
        context.res.body = {
            success: true,
            message: 'Token OBO obtenu avec succès',
            token: oboResponse.accessToken,
            expiresOn: oboResponse.expiresOn,
            scopes: oboResponse.scopes,
            debug: {
                userTokenAud: decoded.aud,
                userTokenScp: decoded.scp,
                requestedScope: scope
            }
        };
        
        context.log('✅ === FIN DIAGNOSTIC - SUCCÈS ===');
        
    } catch (error) {
        context.log.error('❌ === ERREUR ===');
        context.log.error('Message:', error.message);
        context.log.error('Stack:', error.stack);
        
        // Détails MSAL
        if (error.errorCode) {
            context.log.error('Code MSAL:', error.errorCode);
        }
        if (error.errorMessage) {
            context.log.error('Message MSAL:', error.errorMessage);
        }
        
        context.res.status = 500;
        context.res.body = {
            success: false,
            error: error.message,
            errorCode: error.errorCode || error.name,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };
    }
};
