/**
 * Gestionnaire d'authentification MSAL (Microsoft Authentication Library)
 *
 * Ce module gère l'authentification Microsoft avec support du SSO (Single Sign-On)
 * Il tente d'abord une authentification silencieuse, puis utilise une popup si nécessaire
 */

class AuthManager {
    constructor() {
        this.msalInstance = null;
        this.currentAccount = null;
        this.isInitialized = false;
        this.authCallbacks = {
            onSignIn: [],
            onSignOut: [],
            onError: []
        };
    }

    /**
     * Initialise l'instance MSAL
     */
    async initialize() {
        try {
            console.log("Initialisation de MSAL...");

            // Créer l'instance MSAL
            this.msalInstance = new msal.PublicClientApplication(msalConfig);

            // Attendre l'initialisation
            await this.msalInstance.initialize();

            // Gérer les réponses de redirection
            await this.handleRedirectResponse();

            this.isInitialized = true;
            console.log("MSAL initialisé avec succès");

            return true;
        } catch (error) {
            console.error("Erreur lors de l'initialisation de MSAL:", error);
            this.triggerErrorCallbacks(error);
            return false;
        }
    }

    /**
     * Gère la réponse de redirection après authentification
     */
    async handleRedirectResponse() {
        try {
            const response = await this.msalInstance.handleRedirectPromise();
            if (response) {
                console.log("Authentification par redirection réussie:", response);
                this.currentAccount = response.account;
                this.triggerSignInCallbacks(response.account);
            } else {
                // Pas de réponse de redirection, vérifier s'il y a un compte actif
                await this.checkExistingAccount();
            }
        } catch (error) {
            console.error("Erreur lors de la gestion de la redirection:", error);
            this.triggerErrorCallbacks(error);
        }
    }

    /**
     * Vérifie s'il existe déjà un compte connecté
     */
    async checkExistingAccount() {
        const accounts = this.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            console.log(`${accounts.length} compte(s) trouvé(s)`);
            this.currentAccount = accounts[0];
            this.msalInstance.setActiveAccount(this.currentAccount);
            console.log("Compte actif:", this.currentAccount);
            return true;
        }
        console.log("Aucun compte actif trouvé");
        return false;
    }

    /**
     * Tente une authentification silencieuse (SSO)
     * C'est la méthode privilégiée pour le SSO dans D365
     */
    async signInSilent() {
        try {
            console.log("Tentative d'authentification silencieuse (SSO)...");

            // Si on a déjà un compte, l'utiliser
            let account = this.currentAccount;

            // Sinon, essayer de trouver un compte existant
            if (!account) {
                const accounts = this.msalInstance.getAllAccounts();
                if (accounts.length > 0) {
                    account = accounts[0];
                }
            }

            // Préparer la requête de token
            const silentRequest = {
                ...tokenRequest,
                account: account,
                prompt: "none" // Important: ne pas afficher de popup
            };

            // Tenter l'acquisition silencieuse du token
            const response = await this.msalInstance.acquireTokenSilent(silentRequest);

            console.log("Authentification silencieuse réussie:", response);
            this.currentAccount = response.account;
            this.msalInstance.setActiveAccount(this.currentAccount);
            this.triggerSignInCallbacks(this.currentAccount);

            return {
                success: true,
                account: this.currentAccount,
                accessToken: response.accessToken
            };
        } catch (error) {
            console.warn("Échec de l'authentification silencieuse:", error);

            // Si c'est une erreur d'interaction requise, on peut essayer avec popup
            if (error instanceof msal.InteractionRequiredAuthError) {
                console.log("Interaction utilisateur requise");
                return {
                    success: false,
                    requiresInteraction: true,
                    error: error
                };
            }

            this.triggerErrorCallbacks(error);
            return {
                success: false,
                requiresInteraction: false,
                error: error
            };
        }
    }

    /**
     * Authentification interactive avec popup
     * Utilisé quand l'authentification silencieuse échoue
     */
    async signInPopup() {
        try {
            console.log("Ouverture de la popup d'authentification...");

            const response = await this.msalInstance.loginPopup(loginRequest);

            console.log("Authentification popup réussie:", response);
            this.currentAccount = response.account;
            this.msalInstance.setActiveAccount(this.currentAccount);
            this.triggerSignInCallbacks(this.currentAccount);

            return {
                success: true,
                account: this.currentAccount,
                accessToken: response.accessToken
            };
        } catch (error) {
            console.error("Erreur lors de l'authentification popup:", error);
            this.triggerErrorCallbacks(error);
            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Authentification par redirection (au lieu de popup)
     * Utilisé quand les popups sont bloquées ou dans un iframe
     */
    async signInRedirect() {
        try {
            console.log("Redirection vers la page d'authentification...");
            await this.msalInstance.loginRedirect(loginRequest);
            // La page sera rechargée après l'authentification
            return {
                success: true
            };
        } catch (error) {
            console.error("Erreur lors de l'authentification par redirection:", error);
            this.triggerErrorCallbacks(error);
            return {
                success: false,
                error: error
            };
        }
    }

    /**
     * Authentification automatique avec fallback
     * Utilise la REDIRECTION au lieu de popup (mieux pour les iframes)
     */
    async signIn(forceInteractive = false) {
        if (!this.isInitialized) {
            console.error("MSAL n'est pas initialisé");
            return { success: false, error: "MSAL not initialized" };
        }

        // Si on force l'interaction, utiliser la redirection
        if (forceInteractive) {
            return await this.signInRedirect();
        }

        // Sinon, essayer d'abord l'authentification silencieuse
        const silentResult = await this.signInSilent();

        // Si l'authentification silencieuse réussit, on a terminé
        if (silentResult.success) {
            return silentResult;
        }

        // Si une interaction est requise, utiliser la redirection
        if (silentResult.requiresInteraction) {
            console.log("L'authentification silencieuse a échoué, utilisation de la redirection...");
            return await this.signInRedirect();
        }

        // Autre erreur
        return silentResult;
    }

    /**
     * Déconnexion
     */
    async signOut() {
        try {
            if (!this.currentAccount) {
                console.log("Aucun compte connecté");
                return;
            }

            console.log("Déconnexion en cours...");

            const logoutRequest = {
                account: this.currentAccount,
                postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri
            };

            await this.msalInstance.logoutPopup(logoutRequest);

            this.currentAccount = null;
            this.triggerSignOutCallbacks();

            console.log("Déconnexion réussie");
        } catch (error) {
            console.error("Erreur lors de la déconnexion:", error);
            this.triggerErrorCallbacks(error);
        }
    }

    /**
     * Obtient un access token pour les appels API
     * ⚠️ MODIFIÉ : Accepte maintenant forceRefresh pour invalider le cache
     */
    async getAccessToken(scopes = tokenRequest.scopes, forceRefresh = false) {
        try {
            if (!this.currentAccount) {
                console.error("Aucun compte connecté");
                return null;
            }

            const request = {
                scopes: scopes,
                account: this.currentAccount,
                forceRefresh: forceRefresh // ⬅️ NOUVEAU : Force le refresh du token
            };

            const response = await this.msalInstance.acquireTokenSilent(request);
            return response.accessToken;
        } catch (error) {
            console.error("Erreur lors de l'acquisition du token:", error);

            // Si une interaction est requise, utiliser la popup
            if (error instanceof msal.InteractionRequiredAuthError) {
                try {
                    const request = {
                        scopes: scopes,
                        account: this.currentAccount
                    };
                    const response = await this.msalInstance.acquireTokenPopup(request);
                    return response.accessToken;
                } catch (popupError) {
                    console.error("Erreur lors de l'acquisition du token via popup:", popupError);
                    this.triggerErrorCallbacks(popupError);
                    return null;
                }
            }

            this.triggerErrorCallbacks(error);
            return null;
        }
    }

    /**
     * Récupère les informations du compte connecté
     */
    getAccount() {
        return this.currentAccount;
    }

    /**
     * Vérifie si un utilisateur est connecté
     */
    isSignedIn() {
        return this.currentAccount !== null;
    }

    /**
     * Récupère les informations utilisateur depuis Microsoft Graph
     */
    async getUserProfile() {
        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                console.error("Impossible d'obtenir le token d'accès");
                return null;
            }

            const response = await fetch(graphConfig.graphMeEndpoint, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const profile = await response.json();
            console.log("Profil utilisateur récupéré:", profile);
            return profile;
        } catch (error) {
            console.error("Erreur lors de la récupération du profil:", error);
            this.triggerErrorCallbacks(error);
            return null;
        }
    }

    // ========== Gestion des callbacks ==========

    /**
     * Enregistre un callback pour l'événement de connexion
     */
    onSignIn(callback) {
        this.authCallbacks.onSignIn.push(callback);
    }

    /**
     * Enregistre un callback pour l'événement de déconnexion
     */
    onSignOut(callback) {
        this.authCallbacks.onSignOut.push(callback);
    }

    /**
     * Enregistre un callback pour les erreurs
     */
    onError(callback) {
        this.authCallbacks.onError.push(callback);
    }

    /**
     * Déclenche les callbacks de connexion
     */
    triggerSignInCallbacks(account) {
        this.authCallbacks.onSignIn.forEach(callback => {
            try {
                callback(account);
            } catch (error) {
                console.error("Erreur dans le callback onSignIn:", error);
            }
        });
    }

    /**
     * Déclenche les callbacks de déconnexion
     */
    triggerSignOutCallbacks() {
        this.authCallbacks.onSignOut.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error("Erreur dans le callback onSignOut:", error);
            }
        });
    }

    /**
     * Déclenche les callbacks d'erreur
     */
    triggerErrorCallbacks(error) {
        this.authCallbacks.onError.forEach(callback => {
            try {
                callback(error);
            } catch (callbackError) {
                console.error("Erreur dans le callback onError:", callbackError);
            }
        });
    }
}

// Instance globale du gestionnaire d'authentification
const authManager = new AuthManager();
