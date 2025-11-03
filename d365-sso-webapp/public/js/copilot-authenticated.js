/**
 * Intégration Copilot SANS authentification Power Platform
 */

class CopilotAuthenticated {
    constructor() {
        this.isInitialized = false;
        
        this.config = {
            // Bot sans authentification (depuis Settings → Security)
            botId: '7ca13de3-fabc-4164-8f26-904f90e6eff6',
            schemaName: 'cr288_agentBabilou',
            environmentId: '308d8cf6-baa8-eba2-8a15-8afc891fddf9',
            
            // Endpoint pour bot NON-AUTHENTIFIÉ
            apiEndpoint: 'https://308d8cf6baa8eba28a158afc891fdd.f9.environment.api.powerplatform.com',
            apiVersion: '2022-03-01-preview'
        };
    }

    async initialize() {
        try {
            console.log("🤖 === INITIALISATION COPILOT (NO AUTH - SIMPLE) ===");
            console.log("   Bot ID:", this.config.botId);
            console.log("   Schema:", this.config.schemaName);

            if (!window.WebChat) {
                throw new Error("Bot Framework Web Chat SDK n'est pas chargé");
            }

            if (!authManager.isSignedIn()) {
                throw new Error("Utilisateur non connecté");
            }

            console.log("✅ Web Chat SDK chargé");
            console.log("✅ Utilisateur connecté");

            // Obtenir le token Direct Line (sans auth Power Platform !)
            const directLineToken = await this.getDirectLineToken();
            
            console.log("✅ Token Direct Line obtenu");

            // Initialiser le Web Chat
            await this.initializeWebChat(directLineToken);

            this.isInitialized = true;
            console.log("✅ === COPILOT INITIALISÉ AVEC SUCCÈS ===");

        } catch (error) {
            console.error("❌ === ERREUR INITIALISATION COPILOT ===");
            console.error(error);
            this.showError(error.message);
        }
    }

    async getDirectLineToken() {
        try {
            console.log("🔑 === RÉCUPÉRATION TOKEN DIRECT LINE ===");
            
            // Endpoint Direct Line pour bot NON-AUTHENTIFIÉ
            const tokenUrl = `${this.config.apiEndpoint}/powervirtualagents/botsbyschema/${this.config.schemaName}/directline/token?api-version=${this.config.apiVersion}`;
            
            console.log("📍 URL:", tokenUrl);
            console.log("⏳ Appel à l'API Direct Line...");
            
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log("📡 Réponse reçue:", response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Erreur API:", errorText);
                throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            
            if (!data.token) {
                throw new Error("Token manquant dans la réponse");
            }

            console.log("✅ Token Direct Line reçu !");
            console.log("   Conversation ID:", data.conversationId || 'N/A');
            console.log("   Expire:", data.expires_in ? `dans ${data.expires_in}s` : 'N/A');
            
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

    async initializeWebChat(directLineToken) {
        try {
            console.log("🎨 Initialisation du Web Chat...");
            
            const account = authManager.getAccount();
            
            // Créer la connexion Direct Line
            const directLine = window.WebChat.createDirectLine({
                token: directLineToken
            });

            // Préparer les informations utilisateur à passer au bot
            const userContext = {
                userId: account.localAccountId,
                userName: account.name,
                userEmail: account.username
            };

            console.log("👤 Informations utilisateur:", userContext);

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

            // Store pour passer les données utilisateur au bot
            const store = window.WebChat.createStore({}, ({ dispatch }) => next => action => {
                // Lors de la connexion, envoyer les infos utilisateur au bot
                if (action.type === 'DIRECT_LINE/CONNECT_FULFILLED') {
                    console.log("📤 Envoi des informations utilisateur au bot...");
                    
                    // Envoyer un événement avec les infos utilisateur
                    dispatch({
                        type: 'WEB_CHAT/SEND_EVENT',
                        payload: {
                            name: 'webchat/join',
                            value: userContext
                        }
                    });
                }
                return next(action);
            });

            // Rendre le Web Chat
            window.WebChat.renderWebChat(
                {
                    directLine: directLine,
                    store: store,
                    userID: account.localAccountId,
                    username: account.name,
                    locale: 'fr-FR',
                    styleOptions: styleOptions
                },
                document.getElementById('copilot-webchat')
            );

            console.log("✅ Web Chat initialisé");
            console.log("   User ID:", account.localAccountId);
            console.log("   Username:", account.name);

        } catch (error) {
            console.error("❌ Erreur lors de l'initialisation du Web Chat:", error);
            throw error;
        }
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
                            <li>Le bot existe dans Copilot Studio</li>
                            <li>Le bot est publié</li>
                            <li>L'environnement est correct</li>
                            <li>Vérifiez la console (F12) pour plus de détails</li>
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
