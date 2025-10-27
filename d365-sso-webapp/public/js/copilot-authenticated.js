/**
 * Intégration Copilot avec URL CRM générique
 * VERSION FINALE - Utilise https://dynamicscrm.azure.com
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
            apiVersion: '2022-03-01-preview',
            // URL générique Dynamics CRM (fonctionne pour tous les tenants)
            crmScope: 'https://dynamicscrm.azure.com/.default'
        };
    }

    /**
     * Initialise le Copilot avec authentification
     */
    async initialize() {
        try {
            console.log("🤖 === INITIALISATION COPILOT (DYNAMICS CRM) ===");

            if (!window.WebChat) {
                throw new Error("Bot Framework Web Chat SDK n'est pas chargé");
            }

            if (!authManager.isSignedIn()) {
                throw new Error("Utilisateur non connecté");
            }

            console.log("✅ Web Chat SDK chargé");
            console.log("✅ Utilisateur connecté");

            // Obtenir le token Dynamics CRM
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                throw new Error("Impossible d'obtenir le token Dynamics CRM");
            }

            console.log("✅ Token Dynamics CRM obtenu");

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
     * Obtient un token Dynamics CRM avec l'URL générique
     */
    async getAccessToken() {
        try {
            console.log("🔑 === RÉCUPÉRATION TOKEN DYNAMICS CRM ===");
            console.log("📍 Scope:", this.config.crmScope);
            console.log("   (URL générique qui fonctionne pour tous les tenants)");
            
            // Demander le token pour Dynamics CRM avec le scope générique
            const crmToken = await authManager.getAccessToken([
                this.config.crmScope
            ]);
            
            if (!crmToken) {
                throw new Error("Impossible d'obtenir le token Dynamics CRM");
            }
            
            console.log("✅ Token Dynamics CRM obtenu !");
            console.log(`   Preview: ${crmToken.substring(0, 50)}...`);
            
            // Debug : vérifier l'audience
            this.debugToken(crmToken);
            
            console.log("✅ === FIN RÉCUPÉRATION TOKEN - SUCCÈS ===");
            
            return crmToken;

        } catch (error) {
            console.error("❌ === ERREUR RÉCUPÉRATION TOKEN ===");
            console.error("Type:", error.constructor.name);
            console.error("Message:", error.message);
            
            if (error.stack) {
                console.error("Stack:", error.stack);
            }
            
            // Messages d'aide selon l'erreur
            if (error.message && error.message.includes('AADSTS65001')) {
                console.error("💡 AADSTS65001 = Permissions manquantes");
                console.error("   Vérifiez dans Azure AD → API permissions:");
                console.error("   - Dynamics CRM");
                console.error("   - user_impersonation");
                console.error("   - Consentement admin accordé ✅");
            } else if (error.message && error.message.includes('AADSTS500011')) {
                console.error("💡 AADSTS500011 = Resource not found");
                console.error("   Le scope Dynamics CRM n'est pas reconnu");
                console.error("   Vérifiez que vous avez la permission 'Dynamics CRM' dans Azure AD");
            } else if (error.message && error.message.includes('Interaction')) {
                console.error("💡 Interaction requise");
                console.error("   Une popup va s'ouvrir pour le consentement");
            }
            
            throw new Error(`Impossible d'obtenir le token: ${error.message}`);
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
            console.log("   Scopes (scp):", decoded.scp || decoded.roles);
            console.log("   Issuer (iss):", decoded.iss);
            console.log("   Version (ver):", decoded.ver);
            console.log("   Expire:", new Date(decoded.exp * 1000).toLocaleString());
            
            // Vérifier que c'est un token valide
            if (decoded.aud) {
                if (decoded.aud.includes('crm') || decoded.aud.includes('dynamics')) {
                    console.log("   ✅ TOKEN DYNAMICS CRM VALIDE !");
                } else if (decoded.aud.includes('powerplatform')) {
                    console.log("   ✅ TOKEN POWER PLATFORM VALIDE !");
                } else {
                    console.warn("   ⚠️ Audience inattendue mais on essaie quand même");
                }
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
                        <p style="margin: 0;"><strong>Vérifications :</strong></p>
                        <ul style="text-align: left; margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
                            <li>Azure AD → API permissions → Dynamics CRM → user_impersonation ✅</li>
                            <li>Consentement administrateur accordé ✅</li>
                            <li>Vérifiez la console (F12) pour les détails</li>
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
