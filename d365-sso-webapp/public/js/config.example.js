/**
 * Configuration MSAL pour l'authentification Microsoft
 *
 * IMPORTANT: Copiez ce fichier en 'config.js' et remplacez les valeurs par vos propres identifiants Azure AD
 * Le fichier config.js est ignoré par git pour des raisons de sécurité
 */

const msalConfig = {
    auth: {
        // ID de l'application Azure AD (Application/Client ID)
        clientId: "VOTRE_CLIENT_ID_ICI",

        // ID du tenant Azure AD (Directory/Tenant ID)
        // Peut être:
        // - L'ID du tenant spécifique
        // - "common" pour comptes Microsoft et Azure AD
        // - "organizations" pour comptes Azure AD uniquement
        // - "consumers" pour comptes Microsoft uniquement
        authority: "https://login.microsoftonline.com/VOTRE_TENANT_ID_ICI",

        // URI de redirection après authentification
        // Doit correspondre à l'URI configuré dans Azure AD
        redirectUri: "https://localhost:3000",

        // URI de redirection après déconnexion
        postLogoutRedirectUri: "https://localhost:3000",

        // Naviguer vers la page de login au lieu d'utiliser une popup
        navigateToLoginRequestUrl: false
    },
    cache: {
        // Type de stockage pour les tokens
        // "sessionStorage" = tokens perdus à la fermeture du navigateur
        // "localStorage" = tokens persistants
        cacheLocation: "sessionStorage",

        // Cookies sécurisés pour l'authentification
        storeAuthStateInCookie: true // Important pour IE11 et Edge
    },
    system: {
        // Options avancées
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) {
                    return;
                }
                switch (level) {
                    case msal.LogLevel.Error:
                        console.error(message);
                        return;
                    case msal.LogLevel.Info:
                        console.info(message);
                        return;
                    case msal.LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case msal.LogLevel.Warning:
                        console.warn(message);
                        return;
                }
            }
        },
        // Timeout pour les requêtes réseau (en ms)
        networkTimeout: 10000,

        // Activer le mode iframe pour SSO silencieux
        allowRedirectInIframe: true
    }
};

/**
 * Scopes (permissions) demandés lors de l'authentification
 *
 * Scopes communs:
 * - "user.read" : Lire le profil de l'utilisateur
 * - "openid" : Authentification OpenID Connect
 * - "profile" : Accès aux informations de profil de base
 * - "email" : Accès à l'adresse email
 */
const loginRequest = {
    scopes: ["user.read", "openid", "profile", "email"]
};

/**
 * Scopes pour l'acquisition de tokens silencieuse
 */
const tokenRequest = {
    scopes: ["user.read"],
    forceRefresh: false // Mettre à true pour forcer le rafraîchissement du token
};

/**
 * Configuration optionnelle pour Dynamics 365
 */
const d365Config = {
    // URL de base de votre organisation D365
    orgUrl: "https://votre-org.crm.dynamics.com",

    // Version de l'API D365
    apiVersion: "9.2",

    // Scopes spécifiques à D365 (à ajouter si nécessaire)
    // Format: https://votre-org.crm.dynamics.com/.default
    d365Scopes: []
};

/**
 * Endpoints de l'API Microsoft Graph
 */
const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
    graphPhotoEndpoint: "https://graph.microsoft.com/v1.0/me/photo/$value"
};
