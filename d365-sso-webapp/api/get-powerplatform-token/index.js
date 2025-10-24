/**
 * Intégration Copilot avec authentification Microsoft
 * Utilise Microsoft 365 Agents SDK
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
            console.log("🤖 Initialisation du Copilot avec authentification Microsoft...");

            // Vérifier que Web Chat SDK est chargé
            if (!window.WebChat) {
                throw new Error("Bot Framework Web Chat SDK n'est pas chargé");
            }

            // Vérifier que l'utilisateur est connecté
            if (!authManager.isSignedIn()) {
                throw new Error("Utilisateur non connecté. Veuillez vous connecter d'abord.");
            }

            // Obtenir le token d'accès
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                throw new Error("Impossible d'obtenir le token d'accès");
            }

            console.log("✅ Token d'accès obtenu");

            // Créer une conversation avec le bot
            await this.createConversation(accessToken);

            console.log("✅ Conversation créée:", this.conversationId);

            // Initialiser le Web Chat
            await this.initializeWebChat(accessToken);

            this.isInitialized = true;
            console.log("✅ Copilot initialisé avec succès");

        } catch (error) {
            console.error("❌ Erreur lors de l'initialisation du Copilot:", error);
            this.showError(error.message);
        }
    }

    /**
     * Obtient un token d'accès pour Power Platform
     */
    async getAccessToken() {
        try {
            console.log("🔑 === DÉBUT RÉCUPÉRATION TOKEN OBO ===");
            console.log("📍 Étape 1: Obtenir token pour votre API (OBO)");
            console.log("   Scope: api://fa67c7ea-67f2-4175-9e81-01afd04d64f8/access_as_user");
            
            // ⚠️ CRITIQUE : Utiliser le scope de VOTRE API pour le flux OBO
            // PAS user.read (Graph) - ça ne marchera jamais pour OBO !
            const userToken = await authManager.getAccessToken([
                'api://fa67c7ea-67f2-4175-9e81-01afd04d64f8/access_as_user'
            ]);
            
            if (!userToken) {
                throw new Error("Impossible d'obtenir le token API");
            }
            
            console.log("✅ Token API obtenu");
            console.log(`   Preview: ${userToken.substring(0, 50)}...`);
            
            // Debug : Décoder pour vérifier
            this.debugToken(userToken);
            
            console.log("📍 Étape 2: Échanger le token via le backend (OBO)");
            
            // Appeler le backend pour échanger le token
            const response = await fetch('/api/get-powerplatform-token', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`📡 Réponse backend: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Erreur backend:", errorText);
                
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText };
                }
                
                throw new Error(`Backend error ${response.status}: ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            
            if (!data.token) {
                throw new Error("Le backend n'a pas retourné de token");
            }
            
            console.log("✅ Token Power Platform obtenu via backend");
            console.log(`   Preview: ${data.token.substring(0, 50)}...`);
            console.log(`   Expire: ${data.expiresOn}`);
            
            return data.token;

        } catch (error) {
            console.error("❌ === ERREUR DÉTAILLÉE ===");
            console.error("Message:", error.message);
            console.error("Stack:", error.stack);
            
            // Aide au debugging
            if (error.message.includes('AADSTS5002730')) {
                console.error("💡 AADSTS5002730 = Mauvais token envoyé au backend");
                console.error("   Le token doit avoir l'audience: api://fa67c7ea-67f2-4175-9e81-01afd04d64f8");
                console.error("   Pas: https://graph.microsoft.com");
            }
            
            throw new Error("Impossible d'obtenir le token Power Platform");
        }
    }

    /**
     * Debug: Décoder le token pour vérifier l'audience
     */
    debugToken(token) {
        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload));
            
            console.log("🔍 Token décodé:");
            console.log("   Audience (aud):", decoded.aud);
            console.log("   Scopes (scp):", decoded.scp);
            console.log("   Version (ver):", decoded.ver);
            console.log("   Expire:", new Date(decoded.exp * 1000).toLocaleString());
            
            // Vérification critique
            if (decoded.aud && decoded.aud.includes('fa67c7ea-67f2-4175-9e81-01afd04d64f8')) {
                console.log("   ✅ Audience correcte pour OBO !");
            } else {
                console.error("   ❌ ATTENTION : Mauvaise audience !");
                console.error("      Actuelle:", decoded.aud);
                console.error("      Attendue: api://fa67c7ea-67f2-4175-9e81-01afd04d64f8");
            }
            
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
                console.error("Erreur API:", response.status, errorText);
                throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            this.conversationId = data.conversationId;

            console.log("✅ Conversation créée avec succès");

        } catch (error) {
            console.error("Erreur lors de la création de la conversation:", error);
            throw error;
        }
    }

    /**
     * Initialise le Web Chat
     */
    async initializeWebChat(accessToken) {
        try {
            // Créer un adaptateur personnalisé pour Power Platform
            const directLine = this.createPowerPlatformAdapter(accessToken);

            // Obtenir les informations utilisateur
            const account = authManager.getAccount();

            // Configuration du style
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

            // Rendre Web Chat
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
            console.error("Erreur lors de l'initialisation du Web Chat:", error);
            throw error;
        }
    }

    /**
     * Crée un adaptateur pour Power Platform
     */
    createPowerPlatformAdapter(accessToken) {
        const conversationUrl = `${this.config.apiEndpoint}/copilotstudio/dataverse-backed/authenticated/bots/${this.config.botId}/conversations/${this.conversationId}`;
        
        // Utiliser l'adaptateur Direct Line avec l'URL personnalisée
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
                        <p style="margin: 0;"><strong>Suggestions :</strong></p>
                        <ul style="text-align: left; margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
                            <li>Vérifiez que vous êtes bien connecté</li>
                            <li>Rechargez la page</li>
                            <li>Consultez la console (F12) pour plus d'infos</li>
                            <li>Contactez le support si le problème persiste</li>
                        </ul>
                    </div>
                </div>
            `;
        }
    }
}

// Instance globale
const copilotAuthenticated = new CopilotAuthenticated();