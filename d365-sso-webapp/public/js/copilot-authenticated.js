/**
 * Intégration Copilot SANS backend OBO
 * Appel DIRECT à Power Platform depuis le frontend
 * 
 * PLUS SIMPLE mais nécessite d'ajouter les permissions Power Platform dans Azure AD
 */

class CopilotAuthenticated {
    constructor() {
        this.isInitialized = false;
        this.conversationId = null;
        
        // Configuration du bot authentifié
        this.config = {
            environmentId: '308d8cf6-baa8-eba2-8a15-8afc891fddf9',
            botId: 'cr288_chatbotAgentIaBabilou',
            apiEndpoint: 'https://308d8cf6baa8eba28a158afc891fdd.f9.environment.api.powerplatform.com',
            apiVersion: '2022-03-01-preview'
        };
    }

    /**
     * Initialise le Copilot avec authentification
     */
    async initialize() {
        try {
            console.log("🤖 === INITIALISATION COPILOT (DIRECT) ===");

            if (!window.WebChat) {
                throw new Error("Bot Framework Web Chat SDK n'est pas chargé");
            }

            if (!authManager.isSignedIn()) {
                throw new Error("Utilisateur non connecté");
            }

            console.log("✅ Web Chat SDK chargé");
            console.log("✅ Utilisateur connecté");

            // Obtenir le token Power Platform DIRECTEMENT
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                throw new Error("Impossible d'obtenir le token Power Platform");
            }

            console.log("✅ Token Power Platform obtenu");

            // Créer une conversation avec le bot
            await this.createConversation(accessToken);
            console.log("✅ Conversation créée:", this.conversationId);

            // Initialiser le Web Chat
            await this.initializeWebChat(accessToken);

            this.isInitialized = true;
            console.log("✅ === COPILOT INITIALISÉ AVEC SUCCÈS ===");

        } catch (error) {
            console.error("❌ === ERREUR INITIALISATION COPILOT ===");
            console.error(error);
            this.showError(error.message);
        }
    }

    /**
     * Obtient un token Power Platform DIRECTEMENT (sans backend)
     */
    async getAccessToken() {
        try {
            console.log("🔑 === RÉCUPÉRATION TOKEN POWER PLATFORM (DIRECT) ===");
            console.log("📍 Demande directe du token Power Platform");
            console.log("   Scope: https://308d8cf6baa8eba28a158afc891fdd.f9.environment.api.powerplatform.com/.default");
            
            // Demander DIRECTEMENT le token pour Power Platform
            const powerPlatformToken = await authManager.getAccessToken([
                'https://308d8cf6baa8eba28a158afc891fdd.f9.environment.api.powerplatform.com/.default'
            ]);
            
            if (!powerPlatformToken) {
                throw new Error("Impossible d'obtenir le token Power Platform");
            }
            
            console.log("✅ Token Power Platform obtenu directement !");
            console.log(`   Preview: ${powerPlatformToken.substring(0, 50)}...`);
            
            // Debug : vérifier l'audience
            this.debugToken(powerPlatformToken);
            
            console.log("✅ === FIN RÉCUPÉRATION TOKEN - SUCCÈS ===");
            
            return powerPlatformToken;

        } catch (error) {
            console.error("❌ === ERREUR RÉCUPÉRATION TOKEN ===");
            console.error("Message:", error.message);
            console.error("Stack:", error.stack);
            
            // Messages d'aide
            if (error.message && error.message.includes('AADSTS65001')) {
                console.error("💡 AADSTS65001 = Permissions manquantes");
                console.error("   Solution:");
                console.error("   1. Azure AD → App Registration → API permissions");
                console.error("   2. Ajoutez 'Dataverse' ou 'PowerApps-Advisor'");
                console.error("   3. Sélectionnez 'user_impersonation'");
                console.error("   4. Accordez le consentement administrateur");
            } else if (error.message && error.message.includes('Interaction')) {
                console.error("💡 Interaction requise");
                console.error("   L'utilisateur doit donner son consentement");
                console.error("   Une popup va s'ouvrir...");
            }
            
            throw new Error(`Impossible d'obtenir le token Power Platform: ${error.message}`);
        }
    }

    /**
     * Debug : Décoder et vérifier le token JWT
     */
    debugToken(token) {
        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload));
            
            console.log("🔍 === ANALYSE DU TOKEN ===");
            console.log("   Audience (aud):", decoded.aud);
            console.log("   Scopes (scp):", decoded.scp);
            console.log("   Issuer (iss):", decoded.iss);
            console.log("   Version (ver):", decoded.ver);
            console.log("   Expire:", new Date(decoded.exp * 1000).toLocaleString());
            
            // Vérifier que c'est bien un token Power Platform
            if (decoded.aud && decoded.aud.includes('powerplatform.com')) {
                console.log("   ✅ TOKEN POWER PLATFORM VALIDE !");
            } else {
                console.warn("   ⚠️ Audience inattendue:", decoded.aud);
            }
            
            console.log("=========================");
            
        } catch (error) {
            console.warn("⚠️ Impossible de décoder le token:", error);
        }
    }

    /**
     * Crée une conversation avec le bot
     */
    async createConversation(accessToken) {
        try {
            const conversationUrl = `${this.config.apiEndpoint}/copilotstudio/dataverse-backed/authenticated/bots/${this.config.botId}/conversations`;
            const params = new URLSearchParams({
                'api-version': this.config.apiVersion
            });

            console.log("📞 Création de la conversation...");
            console.log("   URL:", `${conversationUrl}?${params}`);

            const response = await fetch(`${conversationUrl}?${params}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    locale: 'fr-FR'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Erreur API:", response.status, errorText);
                throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            this.conversationId = data.conversationId;

            console.log("✅ Conversation créée avec succès");
            console.log("   Conversation ID:", this.conversationId);

        } catch (error) {
            console.error("❌ Erreur lors de la création de la conversation:", error);
            throw error;
        }
    }

    /**
     * Initialise le Web Chat
     */
    async initializeWebChat(accessToken) {
        try {
            console.log("🎨 Initialisation du Web Chat...");
            
            const directLine = this.createPowerPlatformAdapter(accessToken);
            const account = authManager.getAccount();

            const styleOptions = {
                accent: '#0078d4',
                backgroundColor: 'White',
                botAvatarInitials: 'AB',
                botAvatarBackgroundColor: '#0078d4',
                userAvatarInitials: this.getInitials(account.name),
                userAvatarBackgroundColor: '#764ba2',
                bubbleBackground: '#f3f2f1',
                bubbleBorderRadius: 8,
                bubbleFromUserBackground: '#0078d4',
                bubbleFromUserBorderRadius: 8,
                bubbleFromUserTextColor: 'White',
                hideUploadButton: true,
                primaryFont: 'Segoe UI, sans-serif',
                sendBoxBackground: 'White',
                sendBoxButtonColor: '#0078d4',
                sendBoxTextColor: '#000000'
            };

            window.WebChat.renderWebChat(
                {
                    directLine: directLine,
                    userID: account.localAccountId,
                    username: account.name,
                    locale: 'fr-FR',
                    styleOptions: styleOptions
                },
                document.getElementById('copilot-webchat')
            );

            console.log("✅ Web Chat initialisé");

        } catch (error) {
            console.error("❌ Erreur lors de l'initialisation du Web Chat:", error);
            throw error;
        }
    }

    /**
     * Crée un adaptateur pour Power Platform
     */
    createPowerPlatformAdapter(accessToken) {
        const conversationUrl = `${this.config.apiEndpoint}/copilotstudio/dataverse-backed/authenticated/bots/${this.config.botId}/conversations/${this.conversationId}`;
        
        console.log("🔌 Création de l'adaptateur Direct Line");
        console.log("   URL:", conversationUrl);
        
        return window.WebChat.createDirectLine({
            domain: conversationUrl,
            token: accessToken,
            webSocket: false
        });
    }

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
     * Affiche une erreur
     */
    showError(message) {
        const container = document.getElementById('copilot-webchat');
        if (container) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <div style="color: #a4262c; margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0;">❌ Erreur de chargement du Copilot</h4>
                        <p style="margin: 0; font-size: 0.9rem;">${message}</p>
                    </div>
                    <div style="background: #f3f2f1; padding: 1rem; border-radius: 4px; font-size: 0.85rem; color: #605e5c;">
                        <p style="margin: 0;"><strong>Solutions possibles :</strong></p>
                        <ul style="text-align: left; margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
                            <li>Vérifiez que les permissions Power Platform sont ajoutées dans Azure AD</li>
                            <li>Accordez le consentement administrateur pour ces permissions</li>
                            <li>Vérifiez la console (F12) pour plus de détails</li>
                            <li>Rechargez la page</li>
                        </ul>
                    </div>
                    <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Recharger la page
                    </button>
                </div>
            `;
        }
    }
}

// Instance globale
const copilotAuthenticated = new CopilotAuthenticated();
