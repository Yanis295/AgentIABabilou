/**
 * Azure Function pour échanger un token user via OBO
 * VERSION SÉCURISÉE avec validation JWT complète
 */

const msal = require('@azure/msal-node');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

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
        
        // 3. VALIDATION JWT SÉCURISÉE avec vérification de signature
        context.log('🔐 === VALIDATION JWT SÉCURISÉE ===');
        
        const tenantId = process.env.AZURE_TENANT_ID;
        const clientId = process.env.AZURE_CLIENT_ID;

        // Audiences acceptées (Option A - strict)
        const expectedAudiences = new Set([
            `api://${clientId}`,  // Format recommandé
            clientId              // Format alternatif toléré
        ]);

        context.log('   Audiences acceptées:');
        expectedAudiences.forEach(aud => context.log('     -', aud));

        // Configuration JWKS pour récupérer les clés publiques Azure AD
        const jwksClient = jwksRsa({
            jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
            cache: true,
            cacheMaxAge: 86400000, // 24 heures
            rateLimit: true,
            jwksRequestsPerMinute: 10
        });

        // Fonction pour obtenir la clé publique de vérification
        function getKey(header, callback) {
            // Si pas de KID dans le header, récupérer toutes les clés et utiliser la première
            if (!header.kid) {
                context.log.warn('⚠️ Pas de KID dans le header JWT, utilisation de la première clé disponible');
                jwksClient.getSigningKeys((err, keys) => {
                    if (err) {
                        context.log.error('❌ Erreur récupération clés JWKS:', err);
                        return callback(err);
                    }
                    if (!keys || keys.length === 0) {
                        return callback(new Error('Aucune clé disponible dans JWKS'));
                    }
                    const signingKey = keys[0].getPublicKey();
                    context.log('✅ Utilisation de la première clé JWKS');
                    callback(null, signingKey);
                });
            } else {
                // Cas normal avec KID
                jwksClient.getSigningKey(header.kid, (err, key) => {
                    if (err) {
                        context.log.error('❌ Erreur récupération clé JWKS:', err);
                        return callback(err);
                    }
                    const signingKey = key.getPublicKey();
                    callback(null, signingKey);
                });
            }
        }

        // Vérification complète du JWT (signature + issuer + expiration)
        context.log('⏳ Vérification de la signature JWT...');
        
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(
                userToken,
                getKey,
                {
                    algorithms: ['RS256'],
                    issuer: new RegExp(`https://login\\.microsoftonline\\.com/${tenantId}/v2\\.0`),
                    // On ne met pas 'audience' dans les options pour pouvoir contrôler manuellement
                },
                (err, payload) => {
                    if (err) {
                        context.log.error('❌ Erreur vérification JWT:', err.message);
                        reject(err);
                    } else {
                        resolve(payload);
                    }
                }
            );
        });

        context.log('✅ Signature JWT validée !');
        context.log('🔍 Token décodé:');
        context.log('   Audience (aud):', decoded.aud);
        context.log('   Scopes (scp):', decoded.scp || decoded.roles);
        context.log('   Version (ver):', decoded.ver);
        context.log('   Issuer (iss):', decoded.iss);
        context.log('   Subject (sub):', decoded.sub);
        context.log('   Expire (exp):', new Date(decoded.exp * 1000).toISOString());

        // 4. Validation stricte de l'audience
        context.log('🎯 Validation de l\'audience:');
        context.log('   Audience du token:', decoded.aud);
        context.log('   Type audience:', typeof decoded.aud);
        
        if (!expectedAudiences.has(decoded.aud)) {
            context.log.error('❌ AUDIENCE INVALIDE !');
            context.log.error('   Attendu:', Array.from(expectedAudiences).join(' ou '));
            context.log.error('   Reçu:', decoded.aud);
            context.log.error('');
            context.log.error('💡 Vérifiez que:');
            context.log.error('   1. Le frontend demande le scope: api://' + clientId + '/access_as_user');
            context.log.error('   2. L\'App ID URI dans Azure AD est: api://' + clientId);
            context.log.error('   3. Le scope "access_as_user" est bien exposé dans Azure AD');
            
            throw new Error(
                `Audience invalide: attendu ${Array.from(expectedAudiences).join(' ou ')}, reçu ${decoded.aud}`
            );
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
        
        // Détails supplémentaires pour les erreurs JWT
        if (error.name === 'JsonWebTokenError') {
            context.log.error('💡 Erreur JWT détectée');
            if (error.message.includes('invalid signature')) {
                context.log.error('   = Signature invalide');
                context.log.error('   Solution: Vérifiez que le token provient bien d\'Azure AD');
            } else if (error.message.includes('jwt expired')) {
                context.log.error('   = Token expiré');
                context.log.error('   Solution: Le frontend doit redemander un token');
            }
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
            timestamp: new Date().toISOString()
        };
    }
};
