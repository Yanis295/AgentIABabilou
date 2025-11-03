/**
 * Configuration MSAL pour l'authentification Microsoft
 * ARCHITECTURE 2 APP REGISTRATIONS
 */

const msalConfig = {
    auth: {
        // ⚠️ CLIENT ID DE APP #1 (FRONTEND) - NE PAS CHANGER
        clientId: "fa67c7ea-67f2-4175-9e81-01afd04d64f8",

        // ID du tenant Azure AD
        authority: "https://login.microsoftonline.com/ee7b4ccb-8e30-435c-9368-1fce958df645",

        // URI de redirection après authentification
        redirectUri: "https://red-sea-0552aa41e.3.azurestaticapps.net",

        // URI de redirection après déconnexion
        postLogoutRedirectUri: "https://red-sea-0552aa41e.3.azurestaticapps.net",

        // Naviguer vers la page de login au lieu d'utiliser une popup
        navigateToLoginRequestUrl: false
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: true
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return;
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
        networkTimeout: 10000,
        allowRedirectInIframe: true
    }
};

/**
 * ⚠️ NOUVEAU : Configuration pour App #2 (Backend API)
 */
const backendApiConfig = {
    // ✅ CLIENT ID DE APP #2 (BACKEND)
    backendClientId: "d0e218fc-521d-443c-b1b3-0c5036834111",
    
    // Scope pour accéder au backend (construit automatiquement)
    scopes: []
};

// Construire le scope dynamiquement
backendApiConfig.scopes = [
    `api://${backendApiConfig.backendClientId}/access_as_user`
];

console.log("🔧 Configuration Backend API:", {
    clientId: backendApiConfig.backendClientId,
    scope: backendApiConfig.scopes[0]
});

/**
 * Scopes pour Microsoft Graph (profil utilisateur)
 */
const loginRequest = {
    scopes: ["user.read", "openid", "profile", "email"]
};

const tokenRequest = {
    scopes: ["user.read"],
    forceRefresh: false
};

const d365Config = {
    orgUrl: "https://votre-org.crm.dynamics.com",
    apiVersion: "9.2",
    d365Scopes: []
};

const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
    graphPhotoEndpoint: "https://graph.microsoft.com/v1.0/me/photo/$value"
};
