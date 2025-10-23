/**
 * Application principale
 *
 * Orchestre l'authentification MSAL et l'intégration D365
 */

class App {
    constructor() {
        this.isInitialized = false;
        this.debugLogs = [];
    }

    /**
     * Initialise l'application
     */
    async init() {
        try {
            this.log("Démarrage de l'application...");

            // Vérifier si la configuration MSAL est disponible
            if (typeof msalConfig === 'undefined') {
                this.showError("Configuration MSAL non trouvée. Veuillez copier config.example.js en config.js et le configurer.");
                return;
            }

            // Vérifier si les valeurs par défaut n'ont pas été modifiées
            if (msalConfig.auth.clientId.includes("VOTRE_CLIENT_ID") ||
                msalConfig.auth.authority.includes("VOTRE_TENANT_ID")) {
                this.showError("Configuration MSAL non configurée. Veuillez modifier config.js avec vos identifiants Azure AD.");
                this.showConfigHelp();
                return;
            }

            // Initialiser les gestionnaires d'événements
            this.setupEventListeners();

            // Initialiser le gestionnaire d'authentification
            this.updateAuthStatus("Initialisation de l'authentification...");
            const authInitialized = await authManager.initialize();

            if (!authInitialized) {
                this.showError("Échec de l'initialisation de l'authentification");
                return;
            }

            // Initialiser le gestionnaire de contexte D365
            this.updateD365Status("Détection du contexte D365...");
            await d365ContextManager.initialize();

            // Afficher les informations D365
            this.displayD365Context();

            // Enregistrer les callbacks d'authentification
            authManager.onSignIn((account) => {
                this.log("Utilisateur connecté:", account.username);
                this.handleSignIn(account);
            });

            authManager.onSignOut(() => {
                this.log("Utilisateur déconnecté");
                this.handleSignOut();
            });

            authManager.onError((error) => {
                this.log("Erreur d'authentification:", error.message);
                this.handleAuthError(error);
            });

            // Tenter l'authentification automatique (SSO)
            await this.attemptAutoSignIn();

            this.isInitialized = true;
            this.log("Application initialisée avec succès");

        } catch (error) {
            console.error("Erreur lors de l'initialisation:", error);
            this.showError("Erreur lors de l'initialisation: " + error.message);
        }
    }

    /**
     * Configure les gestionnaires d'événements
     */
    setupEventListeners() {
        // Bouton de connexion
        const signInButton = document.getElementById('signin-button');
        if (signInButton) {
            signInButton.addEventListener('click', () => this.handleSignInClick());
        }

        // Bouton de déconnexion
        const signOutButton = document.getElementById('signout-button');
        if (signOutButton) {
            signOutButton.addEventListener('click', () => this.handleSignOutClick());
        }

        // Bouton de rafraîchissement
        const refreshButton = document.getElementById('refresh-button');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.refresh());
        }

        // Bouton de test API
        const testApiButton = document.getElementById('test-api-button');
        if (testApiButton) {
            testApiButton.addEventListener('click', () => this.testApi());
        }
    }

    /**
     * Tente une connexion automatique (SSO)
     */
    async attemptAutoSignIn() {
        try {
            this.updateAuthStatus("Tentative d'authentification automatique (SSO)...");

            // Vérifier s'il y a déjà un compte connecté
            if (authManager.isSignedIn()) {
                this.log("Compte déjà connecté");
                await this.handleSignIn(authManager.getAccount());
                return;
            }

            // Tenter l'authentification silencieuse
            const result = await authManager.signIn(false);

            if (result.success) {
                this.log("Authentification SSO réussie");
                await this.handleSignIn(result.account);
            } else {
                this.log("Authentification SSO non disponible, connexion manuelle requise");
                this.updateAuthStatus("Non connecté");
                this.updateAuthStatusIcon('❌');
                this.showSignInButton();
            }
        } catch (error) {
            console.error("Erreur lors de l'authentification automatique:", error);
            this.updateAuthStatus("Non connecté - Erreur: " + error.message);
            this.updateAuthStatusIcon('❌');
            this.showSignInButton();
        }
    }

    /**
     * Gère la connexion réussie
     */
    async handleSignIn(account) {
        try {
            this.updateAuthStatus(`Connecté en tant que ${account.username}`);
            this.updateAuthStatusIcon('✅');

            // Afficher les informations utilisateur
            await this.displayUserInfo(account);

            // Cacher le bouton de connexion, afficher celui de déconnexion
            this.hideSignInButton();
            this.showSignOutButton();

            // Afficher la section de test API
            this.showApiSection();

            // Afficher le token dans debug
            await this.updateDebugInfo();

        } catch (error) {
            console.error("Erreur lors de la gestion de la connexion:", error);
        }
    }

    /**
     * Gère la déconnexion
     */
    handleSignOut() {
        this.updateAuthStatus("Non connecté");
        this.updateAuthStatusIcon('❌');

        // Cacher les informations utilisateur
        this.hideUserSection();
        this.hideApiSection();

        // Afficher le bouton de connexion
        this.showSignInButton();
        this.hideSignOutButton();

        // Effacer le debug
        this.clearDebugInfo();
    }

    /**
     * Gère les erreurs d'authentification
     */
    handleAuthError(error) {
        this.updateAuthStatus("Erreur: " + error.message);
        this.updateAuthStatusIcon('❌');
        this.showSignInButton();
    }

    /**
     * Affiche les informations utilisateur
     */
    async displayUserInfo(account) {
        try {
            // Afficher les informations de base du compte
            document.getElementById('user-name').textContent = account.name || account.username;
            document.getElementById('user-email').textContent = account.username;
            document.getElementById('user-id').textContent = `ID: ${account.localAccountId}`;

            // Initiales pour l'avatar
            const initials = this.getInitials(account.name || account.username);
            document.getElementById('user-initials').textContent = initials;

            // Afficher la section utilisateur
            this.showUserSection();

            // Récupérer le profil complet depuis Microsoft Graph
            try {
                const profile = await authManager.getUserProfile();
                if (profile) {
                    if (profile.displayName) {
                        document.getElementById('user-name').textContent = profile.displayName;
                    }
                    if (profile.jobTitle) {
                        document.getElementById('user-email').textContent =
                            `${profile.mail || profile.userPrincipalName} - ${profile.jobTitle}`;
                    }
                }
            } catch (error) {
                this.log("Impossible de récupérer le profil Graph:", error.message);
            }

        } catch (error) {
            console.error("Erreur lors de l'affichage des informations utilisateur:", error);
        }
    }

    /**
     * Affiche le contexte D365
     */
    displayD365Context() {
        const context = d365ContextManager.getContextInfo();

        if (context.isInD365) {
            this.updateD365Status("Connecté à Dynamics 365");
            this.updateD365StatusIcon('✅');

            document.getElementById('d365-org').textContent = context.orgName || 'N/A';
            document.getElementById('d365-url').textContent = context.orgUrl || 'N/A';
            document.getElementById('d365-user-id').textContent = context.userId || 'N/A';
            document.getElementById('d365-iframe').textContent = context.isInIframe ? 'Oui' : 'Non';

            this.showD365Section();
        } else {
            this.updateD365Status("Non intégré dans D365");
            this.updateD365StatusIcon('ℹ️');

            if (context.isInIframe) {
                this.updateD365Status("Dans un iframe (mais pas D365 détecté)");
            }
        }
    }

    /**
     * Test d'appel API
     */
    async testApi() {
        try {
            const endpoint = document.getElementById('api-endpoint').value;
            if (!endpoint) {
                alert("Veuillez entrer une URL d'API");
                return;
            }

            this.log("Test d'appel API vers:", endpoint);

            // Récupérer le token d'accès
            const token = await authManager.getAccessToken();
            if (!token) {
                alert("Impossible de récupérer le token d'accès");
                return;
            }

            // Effectuer l'appel API
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            // Afficher la réponse
            document.getElementById('api-response-content').textContent =
                JSON.stringify(data, null, 2);
            document.getElementById('api-response').classList.remove('hidden');

            this.log("Réponse API reçue:", response.status);

        } catch (error) {
            console.error("Erreur lors du test API:", error);
            document.getElementById('api-response-content').textContent =
                `Erreur: ${error.message}`;
            document.getElementById('api-response').classList.remove('hidden');
        }
    }

    /**
     * Rafraîchit la page
     */
    async refresh() {
        this.log("Rafraîchissement...");
        window.location.reload();
    }

    /**
     * Gestion des clics sur les boutons
     */
    async handleSignInClick() {
    try {
        this.updateAuthStatus("Connexion en cours...");
        // Utiliser la redirection au lieu de la popup
        await authManager.signInRedirect();
    } catch (error) {
        console.error("Erreur lors de la connexion:", error);
        this.showError("Erreur lors de la connexion: " + error.message);
    }
}

    async handleSignOutClick() {
        try {
            this.updateAuthStatus("Déconnexion en cours...");
            await authManager.signOut();
        } catch (error) {
            console.error("Erreur lors de la déconnexion:", error);
            this.showError("Erreur lors de la déconnexion: " + error.message);
        }
    }

    // ========== Méthodes utilitaires ==========

    /**
     * Obtient les initiales d'un nom
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    /**
     * Met à jour le statut d'authentification
     */
    updateAuthStatus(status) {
        const element = document.getElementById('auth-status');
        if (element) {
            element.textContent = status;
        }
    }

    updateAuthStatusIcon(icon) {
        const element = document.getElementById('auth-status-icon');
        if (element) {
            element.textContent = icon;
        }
    }

    /**
     * Met à jour le statut D365
     */
    updateD365Status(status) {
        const element = document.getElementById('d365-status');
        if (element) {
            element.textContent = status;
        }
    }

    updateD365StatusIcon(icon) {
        const element = document.getElementById('d365-status-icon');
        if (element) {
            element.textContent = icon;
        }
    }

    /**
     * Affiche/cache les sections
     */
    showUserSection() {
        document.getElementById('user-section')?.classList.remove('hidden');
    }

    hideUserSection() {
        document.getElementById('user-section')?.classList.add('hidden');
    }

    showD365Section() {
        document.getElementById('d365-section')?.classList.remove('hidden');
    }

    showApiSection() {
        document.getElementById('api-section')?.classList.remove('hidden');
    }

    hideApiSection() {
        document.getElementById('api-section')?.classList.add('hidden');
    }

    showSignInButton() {
        document.getElementById('signin-button')?.classList.remove('hidden');
    }

    hideSignInButton() {
        document.getElementById('signin-button')?.classList.add('hidden');
    }

    showSignOutButton() {
        document.getElementById('signout-button')?.classList.remove('hidden');
    }

    hideSignOutButton() {
        document.getElementById('signout-button')?.classList.add('hidden');
    }

    /**
     * Affiche les informations de debug
     */
    async updateDebugInfo() {
        try {
            // Configuration
            const configElement = document.getElementById('debug-config');
            if (configElement) {
                configElement.textContent = JSON.stringify({
                    clientId: msalConfig.auth.clientId,
                    authority: msalConfig.auth.authority,
                    redirectUri: msalConfig.auth.redirectUri
                }, null, 2);
            }

            // Token (preview)
            const token = await authManager.getAccessToken();
            if (token) {
                const tokenElement = document.getElementById('debug-token');
                if (tokenElement) {
                    // Afficher seulement les 50 premiers caractères
                    tokenElement.textContent = token.substring(0, 50) + '...';
                }
            }

            // Logs
            this.updateDebugLogs();

        } catch (error) {
            console.error("Erreur lors de la mise à jour du debug:", error);
        }
    }

    clearDebugInfo() {
        document.getElementById('debug-token').textContent = '';
    }

    updateDebugLogs() {
        const logsElement = document.getElementById('debug-logs');
        if (logsElement) {
            logsElement.innerHTML = this.debugLogs
                .map(log => `<div class="debug-log-entry">[${log.time}] ${log.message}</div>`)
                .join('');
        }
    }

    /**
     * Affiche une erreur
     */
    showError(message) {
        console.error(message);
        alert(message);
    }

    /**
     * Affiche l'aide de configuration
     */
    showConfigHelp() {
        const helpMessage = `
Pour configurer l'application:

1. Copiez le fichier public/js/config.example.js en public/js/config.js
2. Créez une Azure AD App Registration (voir docs/AZURE_SETUP.md)
3. Remplacez VOTRE_CLIENT_ID et VOTRE_TENANT_ID dans config.js
4. Redémarrez l'application
        `;
        alert(helpMessage);
    }

    /**
     * Ajoute un log de debug
     */
    log(message, ...args) {
        const time = new Date().toLocaleTimeString();
        this.debugLogs.push({
            time: time,
            message: typeof message === 'object' ? JSON.stringify(message) : message
        });

        // Limiter à 50 logs
        if (this.debugLogs.length > 50) {
            this.debugLogs.shift();
        }

        this.updateDebugLogs();
        console.log(`[${time}]`, message, ...args);
    }
}

// Initialiser l'application au chargement de la page
const app = new App();
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
