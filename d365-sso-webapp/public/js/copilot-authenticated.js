/**
 * Intégration Copilot Studio via iframe
 * SIMPLE ET FONCTIONNE À COUP SÛR !
 * L'utilisateur est identifié via les paramètres URL
 */

class CopilotAuthenticated {
    constructor() {
        this.isInitialized = false;
        
        this.config = {
            // URL de base de l'iframe Copilot
            baseUrl: 'https://copilotstudio.microsoft.com/environments/308d8cf6-baa8-eba2-8a15-8afc891fddf9/bots/cr288_agentBabilou/webchat',
            version: '2'
        };
    }

    async initialize() {
        try {
            console.log("🤖 === INITIALISATION COPILOT (IFRAME + USER INFO) ===");

            if (!authManager.isSignedIn()) {
                throw new Error("Utilisateur non connecté");
            }

            console.log("✅ Utilisateur connecté");

            // Récupérer les informations utilisateur
            const account = authManager.getAccount();
            const userInfo = {
                userId: account.localAccountId,
                userName: account.name,
                userEmail: account.username
            };

            console.log("👤 Informations utilisateur:", userInfo);

            // Créer l'iframe avec les infos utilisateur
            this.createCopilotIframe(userInfo);

            this.isInitialized = true;
            console.log("✅ === COPILOT INITIALISÉ AVEC SUCCÈS ===");

        } catch (error) {
            console.error("❌ === ERREUR INITIALISATION COPILOT ===");
            console.error(error);
            this.showError(error.message);
        }
    }

    createCopilotIframe(userInfo) {
        try {
            console.log("🎨 Création de l'iframe Copilot...");
            
            // Construire l'URL avec les paramètres utilisateur
            const params = new URLSearchParams({
                __version__: this.config.version,
                // Passer les informations utilisateur
                userId: userInfo.userId,
                userName: userInfo.userName,
                userEmail: userInfo.userEmail
            });

            const iframeUrl = `${this.config.baseUrl}?${params.toString()}`;
            
            console.log("📍 URL iframe:", iframeUrl);

            // Créer l'iframe
            const container = document.getElementById('copilot-webchat');
            
            container.innerHTML = `
                <iframe 
                    src="${iframeUrl}"
                    frameborder="0"
                    style="width: 100%; height: 100%; border: none;"
                    allow="microphone; camera"
                    title="Copilot Babilou"
                ></iframe>
            `;

            console.log("✅ Iframe créé et inséré");
            console.log("   User ID:", userInfo.userId);
            console.log("   User Name:", userInfo.userName);
            console.log("   User Email:", userInfo.userEmail);

            // Afficher un message de bienvenue temporaire
            this.showWelcomeMessage(userInfo.userName);

        } catch (error) {
            console.error("❌ Erreur lors de la création de l'iframe:", error);
            throw error;
        }
    }

    showWelcomeMessage(userName) {
        // Créer un overlay de bienvenue qui disparaît après 2 secondes
        const container = document.getElementById('copilot-webchat');
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeOut 2s forwards;
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center; color: white;">
                <h2 style="margin: 0 0 1rem 0; font-size: 2rem;">👋</h2>
                <h3 style="margin: 0 0 0.5rem 0;">Bonjour ${userName} !</h3>
                <p style="margin: 0; opacity: 0.9;">Chargement du Copilot...</p>
            </div>
        `;

        // Ajouter l'animation CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; }
                80% { opacity: 1; }
                100% { opacity: 0; pointer-events: none; }
            }
        `;
        document.head.appendChild(style);

        container.style.position = 'relative';
        container.appendChild(overlay);

        // Retirer l'overlay après l'animation
        setTimeout(() => {
            overlay.remove();
        }, 2000);
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
                            <li>Le bot est publié dans Copilot Studio</li>
                            <li>Le canal "Custom website" est activé</li>
                            <li>L'URL du bot est correcte</li>
                            <li>Vous êtes connecté avec un compte Microsoft</li>
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
