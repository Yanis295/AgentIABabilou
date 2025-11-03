/**
 * Azure Function pour obtenir un token Power Platform
 * MODE CLIENT CREDENTIALS (pas OBO)
 * Plus simple et fonctionne à coup sûr !
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
        context.log('🔄 ===== DÉBUT RÉCUPÉRATION TOKEN (CLIENT CREDENTIALS) =====');
        
        // 1. Vérifier les variables d'environnement
        if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_TENANT_ID || 
            !process.env.AZURE_CLIENT_SECRET || !process.env.POWER_PLATFORM_ENDPOINT) {
            throw new Error('Variables d\'environnement manquantes');
        }
        
        context.log('✅ Variables d\'environnement présentes');
        
        // 2. Récupérer les informations utilisateur (optionnel mais utile pour les logs)
        const authHeader = req.headers.authorization;
        let userInfo = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const userToken = authHeader.substring(7);
            try {
                // Décoder le token pour récupérer les infos utilisateur
                const parts = userToken.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                    userInfo = {
                        name: payload.name,
                        email: payload.preferred_username || payload.email || payload.upn,
                        userId: payload.oid || payload.sub
                    };
                    context.log('✅ Utilisateur:', userInfo.email);
                }
            } catch (e) {
                context.log.warn('⚠️  Impossible de décoder le token utilisateur:', e.message);
            }
        }
        
        // 3. Configuration MSAL pour Client Credentials
        const confidentialClientConfig = {
            auth: {
                clientId: process.env.AZURE_CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
                clientSecret: process.env.AZURE_CLIENT_SECRET
            }
        };

        context.log('🔧 Configuration MSAL (Client Credentials)');
        const confidentialClient = new msal.ConfidentialClientApplication(confidentialClientConfig);

        // 4. Obtenir le token avec Client Credentials Flow
        // IMPORTANT: Demander le token pour l'API Power Platform, pas juste Dataverse
        const powerPlatformApiScope = `${process.env.POWER_PLATFORM_ENDPOINT}/.default`;
        
        const clientCredentialRequest = {
            scopes: [powerPlatformApiScope],
            skipCache: false
        };

        context.log('⏳ Appel à acquireTokenByClientCredential...');
        context.log('   Scope:', powerPlatformApiScope);
        
        const response = await confidentialClient.acquireTokenByClientCredential(clientCredentialRequest);
        
        if (!response || !response.accessToken) {
            throw new Error('Aucun token reçu');
        }

        context.log('✅ ===== TOKEN POWER PLATFORM OBTENU ! =====');
        context.log('   Scopes:', response.scopes || [powerPlatformApiScope]);
        context.log('   Expire à:', new Date(response.expiresOn).toISOString());
        context.log('   Longueur token:', response.accessToken.length);
        if (userInfo) {
            context.log('   Pour l\'utilisateur:', userInfo.email);
        }

        // 5. Retourner le token + infos utilisateur
        context.res.status = 200;
        context.res.body = {
            success: true,
            token: response.accessToken,
            expiresOn: response.expiresOn,
            scopes: response.scopes || [powerPlatformApiScope],
            user: userInfo // Infos utilisateur pour personnalisation
        };

        context.log('✅ ===== FIN RÉCUPÉRATION TOKEN - SUCCÈS =====');

    } catch (error) {
        context.log.error('❌ ===== ERREUR RÉCUPÉRATION TOKEN =====');
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

        // Messages d'aide selon le code d'erreur
        if (error.message && error.message.includes('AADSTS')) {
            const errorCode = error.message.match(/AADSTS\d+/)?.[0];
            context.log.error('💡 Code erreur Azure AD:', errorCode);
            
            switch (errorCode) {
                case 'AADSTS50013':
                    context.log.error('   = Client secret invalide ou expiré');
                    break;
                case 'AADSTS65001':
                    context.log.error('   = Permissions API manquantes');
                    context.log.error('   Solution: Ajoutez permissions Power Platform et accordez admin consent');
                    break;
                case 'AADSTS700016':
                    context.log.error('   = Application non trouvée');
                    context.log.error('   Solution: Vérifiez AZURE_CLIENT_ID');
                    break;
            }
        }

        context.res.status = error.statusCode || 500;
        context.res.body = {
            success: false,
            error: error.message,
            errorCode: error.errorCode || error.name || 'UNKNOWN_ERROR',
            timestamp: new Date().toISOString()
        };
    }
};
