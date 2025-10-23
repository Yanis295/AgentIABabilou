/**
 * Configuration MSAL pour l'authentification Microsoft
 */

const msalConfig = {
    auth: {
        // ID de l'application Azure AD (Application/Client ID)
        clientId: "fa67c7ea-67f2-4175-9e81-01afd04d64f8",

        // ID du tenant Azure AD (Directory/Tenant ID)
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