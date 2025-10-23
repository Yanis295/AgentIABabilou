# Page Web Personnalisée pour Dynamics 365 avec SSO Microsoft

Application web permettant l'intégration d'une page personnalisée dans Dynamics 365 Customer Service avec authentification automatique via Microsoft SSO (Single Sign-On).

## 🎯 Objectif

Cette application permet d'afficher une page web dans un panneau/iframe de Dynamics 365 Customer Service. Les utilisateurs déjà connectés à D365 bénéficient d'une authentification automatique (SSO) sans avoir à ressaisir leurs identifiants.

## ✨ Fonctionnalités

- ✅ **Authentification Microsoft SSO** via MSAL.js 2.x
- ✅ **Tentative d'authentification silencieuse** en priorité (expérience SSO)
- ✅ **Fallback vers popup** si le SSO silencieux échoue
- ✅ **Détection automatique du contexte D365** (iframe, organisation, utilisateur)
- ✅ **Interface utilisateur responsive** compatible avec les panneaux D365
- ✅ **Appels API sécurisés** avec tokens d'authentification
- ✅ **Support HTTPS** avec génération automatique de certificats SSL
- ✅ **Gestion des erreurs** et logs de debug détaillés

## 📋 Prérequis

### Système

- **Node.js** 14.x ou supérieur
- **npm** 6.x ou supérieur
- **OpenSSL** (pour les certificats SSL en développement)

### Azure / Microsoft 365

- Un **tenant Azure Active Directory**
- Droits pour créer une **Azure AD App Registration**
- Accès à **Dynamics 365 Customer Service** (pour l'intégration)

## 🚀 Installation Rapide

### 1. Cloner ou télécharger le projet

```bash
cd d365-sso-webapp
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'authentification MSAL

```bash
# Copier le fichier de configuration exemple
cp public/js/config.example.js public/js/config.js
```

Éditez `public/js/config.js` et remplacez :
- `VOTRE_CLIENT_ID_ICI` par votre Application (client) ID
- `VOTRE_TENANT_ID_ICI` par votre Directory (tenant) ID

**⚠️ Important :** Consultez [docs/AZURE_SETUP.md](docs/AZURE_SETUP.md) pour créer et configurer votre Azure AD App Registration.

### 4. Démarrer le serveur de développement

```bash
npm start
```

Le serveur démarre en HTTPS sur `https://localhost:3000`

### 5. Accepter le certificat SSL auto-signé

Lors de votre première visite, votre navigateur affichera un avertissement de sécurité (certificat auto-signé).

**Pour continuer :**
1. Cliquez sur "Avancé" ou "Paramètres avancés"
2. Cliquez sur "Continuer vers le site" ou "Accepter le risque"

C'est normal et sécuritaire en développement local.

### 6. Tester l'application

L'application devrait :
1. Détecter qu'aucun utilisateur n'est connecté
2. Tenter une authentification silencieuse (SSO)
3. Afficher un bouton de connexion si nécessaire
4. Une fois connecté, afficher vos informations utilisateur

## 📁 Structure du Projet

```
d365-sso-webapp/
├── public/                      # Fichiers publics (frontend)
│   ├── index.html              # Page principale
│   ├── css/
│   │   └── styles.css          # Styles CSS
│   └── js/
│       ├── config.example.js   # Template de configuration MSAL
│       ├── config.js           # Configuration MSAL (à créer, ignoré par git)
│       ├── auth.js             # Gestionnaire d'authentification MSAL
│       ├── d365-context.js     # Gestionnaire de contexte D365
│       └── app.js              # Application principale
├── docs/                        # Documentation
│   ├── AZURE_SETUP.md          # Configuration Azure AD
│   ├── D365_INTEGRATION.md     # Intégration dans D365
│   └── TROUBLESHOOTING.md      # Résolution de problèmes
├── server.js                    # Serveur de développement Node.js
├── package.json                 # Dépendances npm
├── .env.example                 # Template de variables d'environnement
├── .gitignore                   # Fichiers ignorés par git
└── README.md                    # Ce fichier
```

## 🔧 Configuration

### Variables d'environnement (.env)

Copiez `.env.example` en `.env` et modifiez si nécessaire :

```env
PORT=3000
HOST=localhost
USE_HTTPS=true
```

### Configuration MSAL (public/js/config.js)

Paramètres principaux à configurer :

```javascript
const msalConfig = {
    auth: {
        clientId: "votre-client-id",           // Application ID
        authority: "https://login.microsoftonline.com/votre-tenant-id",
        redirectUri: "https://localhost:3000",  // URI de redirection
    }
};
```

**Pour plus de détails :** [docs/AZURE_SETUP.md](docs/AZURE_SETUP.md)

## ☁️ Déploiement sur Azure Static Web Apps

Cette application est optimisée pour Azure Static Web Apps qui offre :

- **Déploiement automatique** depuis GitHub
- **HTTPS gratuit** avec certificat SSL
- **CDN global** pour des performances optimales
- **Azure Functions intégrées** pour l'API backend
- **Environnements de staging** pour chaque pull request

### Déploiement rapide

1. **Créez une Static Web App** dans le portail Azure
2. **Connectez votre dépôt GitHub** lors de la création
3. **Configurez les chemins** :
   - App location: `/d365-sso-webapp/public`
   - Api location: `/d365-sso-webapp/api`
   - Output location: (laisser vide)
4. Azure crée automatiquement un workflow GitHub Actions
5. Le déploiement se fait automatiquement à chaque push

**Guide complet :** [docs/AZURE_STATIC_WEB_APPS.md](docs/AZURE_STATIC_WEB_APPS.md)

## 🔗 Intégration dans Dynamics 365

Une fois l'application déployée :

1. **Mettre à jour les URIs** dans Azure AD avec l'URL de production
2. **Configurer config.js** avec la nouvelle redirectUri
3. **Intégrer dans D365** via un Web Resource ou iframe personnalisé

**Guide complet :** [docs/D365_INTEGRATION.md](docs/D365_INTEGRATION.md)

## 🧪 Test de l'authentification

### Test local (hors D365)

1. Ouvrez `https://localhost:3000` dans votre navigateur
2. L'application tente une authentification silencieuse
3. Si nécessaire, cliquez sur "Se connecter"
4. Authentifiez-vous avec votre compte Microsoft
5. Vérifiez que vos informations s'affichent

### Test dans D365

1. Connectez-vous à Dynamics 365 Customer Service
2. Ouvrez le formulaire/panneau contenant votre iframe
3. L'application devrait détecter le contexte D365
4. L'authentification SSO devrait fonctionner automatiquement

## 🔐 Sécurité

### En développement

- Certificats SSL auto-signés générés automatiquement
- `config.js` ignoré par git pour protéger les identifiants
- Logs de debug activés

### En production

- ⚠️ **Utilisez un certificat SSL valide** (Let's Encrypt, etc.)
- ⚠️ **Stockez les secrets dans des variables d'environnement**
- ⚠️ **Désactivez les logs de debug**
- ⚠️ **Configurez correctement les CORS**
- ⚠️ **Validez les tokens côté backend**

## 🛠️ Scripts npm

```bash
# Démarrer le serveur de développement
npm start

# Alias de npm start
npm run dev

# Tests (à implémenter)
npm test
```

## 📚 Documentation Complète

- **[AZURE_SETUP.md](docs/AZURE_SETUP.md)** : Configuration détaillée d'Azure AD App Registration
- **[AZURE_STATIC_WEB_APPS.md](docs/AZURE_STATIC_WEB_APPS.md)** : Déploiement sur Azure Static Web Apps
- **[D365_INTEGRATION.md](docs/D365_INTEGRATION.md)** : Intégration complète dans Dynamics 365
- **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** : Résolution des problèmes courants

## 🐛 Problèmes Courants

### L'authentification silencieuse échoue toujours

- Vérifiez que vous êtes en HTTPS
- Vérifiez que `storeAuthStateInCookie: true` dans config.js
- Consultez [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#sso-issues)

### Erreur "CORS" ou "Blocked by CORS policy"

- Vérifiez que l'URI de redirection est configurée dans Azure AD
- Vérifiez que le serveur autorise les CORS
- Consultez [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#cors-issues)

### L'application ne fonctionne pas dans l'iframe D365

- Vérifiez que `X-Frame-Options` est configuré correctement
- Vérifiez que les cookies tiers sont autorisés
- Consultez [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#iframe-issues)

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Forkez le projet
2. Créez une branche pour votre fonctionnalité
3. Committez vos changements
4. Poussez vers la branche
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.

## 🔗 Ressources

### MSAL.js

- [Documentation MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Guide d'intégration MSAL.js 2.x](https://docs.microsoft.com/en-us/azure/active-directory/develop/tutorial-v2-javascript-auth-code)

### Dynamics 365

- [Documentation Dynamics 365 Customer Service](https://docs.microsoft.com/en-us/dynamics365/customer-service/)
- [Guide des Web Resources](https://docs.microsoft.com/en-us/powerapps/developer/model-driven-apps/web-resources)
- [Client API Reference](https://docs.microsoft.com/en-us/powerapps/developer/model-driven-apps/clientapi/reference)

### Azure Active Directory

- [Azure AD App Registration](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [OAuth 2.0 et OpenID Connect](https://docs.microsoft.com/en-us/azure/active-directory/develop/active-directory-v2-protocols)

## 💡 Support

Pour toute question ou problème :

1. Consultez la [documentation](docs/)
2. Vérifiez les [problèmes courants](docs/TROUBLESHOOTING.md)
3. Ouvrez une issue sur GitHub

---

Développé avec ❤️ pour faciliter l'intégration SSO dans Dynamics 365
