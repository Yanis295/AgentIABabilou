/**
 * Intégration Copilot avec Client Credentials Flow
 * PLUS SIMPLE - FONCTIONNE À COUP SÛR !
 */

class CopilotAuthenticated {
    constructor() {
        this.isInitialized = false;
        this.conversationId = null;
        
        this.config = {
            environmentId: '308d8cf6-baa8-eba2-8a15-8afc891fddf9',
            botId: 'cr288_chatbotAgentIaBabilou',
            // L'endpoint API Power Platform (pas Dataverse)
            apiEndpoint: 'https://308d8cf6baa8eba28a158afc891fdd.f9.environment.api.powerplatform.com',
            apiVersion: '2022-03-01-preview',
            tokenEndpoint: '/api/get-powerplatform-token'
        };
    }

    async initialize() {
        try {
            console.log("🤖 === INITIALISATION COPILOT (CLIENT CREDENTIALS) ===");

            if (!window.WebChat) {
                throw new Error("Bot Framework Web Chat SDK n'est pas chargé");
            }

            if (!authManager.isSignedIn()) {
                throw new Error("Utilisateur non connecté");
            }

            console.log("✅ Web Chat SDK chargé");
            console.log("✅ Utilisateur connecté");

            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                throw new Error("Impossible d'obtenir le token Power Platform");
            }

            console.log("✅ Token Power Platform obtenu");

            await this.createConversation(accessToken);
            console.log("✅ Conversation créée:", this.conversationId);

            await this.initializeWebChat(accessToken);

            this.isInitialized = true;
            console.log("✅ === COPILOT INITIALISÉ AVEC SUCCÈS ===");

        } catch (error) {
            console.error("❌ === ERREUR INITIALISATION COPILOT ===");
            console.error(error);
            this.showError(error.message);
        }
    }

    async getAccessToken() {
        try {
            console.log("🔑 === RÉCUPÉRATION TOKEN (CLIENT CREDENTIALS) ===");
            console.log("📍 Endpoint:", this.config.tokenEndpoint);
            
            // Récupérer le token utilisateur (pour l'identité)
            console.log("⏳ Récupération du token utilisateur...");
            const userToken = await authManager.getAccessToken();
            
            if (!userToken) {
                console.warn("⚠️  Pas de token utilisateur, continuons quand même");
            } else {
                console.log("✅ Token utilisateur obtenu");
            }
            
            console.log("⏳ Appel à l'Azure Function...");
            
            const response = await fetch(this.config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': userToken ? `Bearer ${userToken}` : ''
                }
            });

            console.log("📡 Réponse reçue:", response.status, response.statusText);

            if (!response.ok) {
                let errorMessage;
                
                try {
                    const errorData = await response.json();
                    console.error("❌ Erreur API:", errorData);
                    errorMessage = errorData.error || errorData.message || `Erreur HTTP ${response.status}`;
                } catch (jsonError) {
                    const errorText = await response.text();
                    console.error("❌ Erreur API (texte):", errorText);
                    errorMessage = errorText || `Erreur HTTP ${response.status}`;
                }
                
                throw new Error(errorMessage);
            }

            const data = await response.json();
            
            if (!data.success || !data.token) {
                throw new Error("Réponse invalide de l'API");
            }

            console.log("✅ Token Power Platform reçu !");
            if (data.scopes) console.log("   Scopes:", data.scopes);
            if (data.expiresOn) console.log("   Expire:", new Date(data.expiresOn).toLocaleString());
            if (data.user) console.log("   Utilisateur:", data.user.email);
            
            console.log("✅ === FIN RÉCUPÉRATION TOKEN - SUCCÈS ===");
            
            return data.token;

        } catch (error) {
            console.error("❌ === ERREUR RÉCUPÉRATION TOKEN ===");
            console.error("Type:", error.constructor.name);
            console.error("Message:", error.message);
            
            if (error.stack) {
                console.error("Stack:", error.stack);
            }
            
            throw new Error(`Impossible d'obtenir le token: ${error.message}`);
        }
    }

    async createConversation(accessToken) {
        try {
            const conversationUrl = `${this.config.apiEndpoint}/copilotstudio/dataverse-backed/authenticated/bots/${this.config.botId}/conversations`;
            const params = new URLSearchParams({
                'api-version': this.config.apiVersion
            });

            console.log("📞 Création de la conversation...");

            // Récupérer les infos utilisateur pour les passer au bot
            const account = authManager.getAccount();
            
            const response = await fetch(`${conversationUrl}?${params}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    locale: 'fr-FR',
                    // Passer les infos utilisateur au bot
                    context: {
                        userName: account.name,
                        userEmail: account.username,
                        userId: account.localAccountId
                    }
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
            console.log("   Utilisateur:", account.name);

        } catch (error) {
            console.error("❌ Erreur lors de la création de la conversation:", error);
            throw error;
        }
    }

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

    createPowerPlatformAdapter(accessToken) {
        const conversationUrl = `${this.config.apiEndpoint}/copilotstudio/dataverse-backed/authenticated/bots/${this.config.botId}/conversations/${this.conversationId}`;
        
        console.log("🔌 Création de l'adaptateur Direct Line");
        
        return window.WebChat.createDirectLine({
            domain: conversationUrl,
            token: accessToken,
            webSocket: false
        });
    }

    getInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

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
                            <li>Variables d'environnement Azure Static Web App configurées</li>
                            <li>Client Secret valide (App #2)</li>
                            <li>Permissions Power Platform accordées à App #2</li>
                            <li>Admin consent accordé</li>
                            <li>Vérifiez la console (F12) et les logs Azure Function</li>
                        </ul>
                    </div>
                    <button onclick="location.reload();" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Recharger la page
                    </button>
                </div>
            `;
        }
    }
}

// Instance globale
const copilotAuthenticated = new CopilotAuthenticated();
