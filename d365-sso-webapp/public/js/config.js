/**
 * Configuration MSAL pour l'authentification Microsoft
 */

const msalConfig = {
    auth: {
        // ID de l'application Azure AD (Application/Client ID)
        clientId: "6fa7c6ae-b7f2-4175-8e81-01af5bfdd48",

        // ID du tenant Azure AD (Directory/Tenant ID)
        authority: "https://login.microsoftonline.com/da2a5e78-7185-44fd-9538-bfc593054289",

        // URI de redirection après authentification
        redirectUri: "https://red-sea-0552aa41e3.azurestaticapps.net",

        // URI de redirection après déconnexion
        postLogoutRedirectUri: "https://red-sea-0552aa41e3.azurestaticapps.net",

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