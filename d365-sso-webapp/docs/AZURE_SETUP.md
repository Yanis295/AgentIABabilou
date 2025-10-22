# Configuration Azure AD App Registration

Ce guide détaille la création et la configuration d'une Azure AD App Registration pour activer l'authentification Microsoft SSO dans votre application.

## 📋 Prérequis

- Accès au **portail Azure** (https://portal.azure.com)
- Droits pour créer une **App Registration** dans Azure AD
- Un **tenant Azure AD** (fourni avec Microsoft 365/Dynamics 365)

## 🚀 Étape 1 : Créer l'App Registration

### 1.1. Accéder au portail Azure

1. Connectez-vous à https://portal.azure.com
2. Dans la barre de recherche, tapez "Azure Active Directory"
3. Cliquez sur "Azure Active Directory"

### 1.2. Créer une nouvelle App Registration

1. Dans le menu de gauche, cliquez sur **"App registrations"**
2. Cliquez sur **"+ New registration"** (Nouvelle inscription)
3. Remplissez le formulaire :

#### Configuration de base

| Champ | Valeur |
|-------|--------|
| **Name** | `D365 SSO Web App` (ou un nom descriptif) |
| **Supported account types** | Choisissez selon votre besoin :<br>• **Single tenant** : Uniquement votre organisation (recommandé)<br>• **Multitenant** : N'importe quelle organisation Azure AD<br>• **Multitenant + Personal** : Organisations + comptes Microsoft personnels |

#### Redirect URI (URI de redirection)

**Important :** Sélectionnez le type "Single-page application (SPA)"

**Pour le développement local :**
- Type : `Single-page application (SPA)`
- URI : `https://localhost:3000`

**Pour la production :**
- Type : `Single-page application (SPA)`
- URI : `https://votre-domaine.com` (à ajouter plus tard)

4. Cliquez sur **"Register"**

## 🔑 Étape 2 : Récupérer les identifiants

Après la création, vous êtes redirigé vers la page de l'application.

### 2.1. Copier l'Application (client) ID

Sur la page **"Overview"** :

```
Application (client) ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**➡️ Copiez cette valeur** - c'est votre `CLIENT_ID`

### 2.2. Copier le Directory (tenant) ID

Sur la même page **"Overview"** :

```
Directory (tenant) ID: yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
```

**➡️ Copiez cette valeur** - c'est votre `TENANT_ID`

## ⚙️ Étape 3 : Configurer l'authentification

### 3.1. Accéder aux paramètres d'authentification

1. Dans le menu de gauche, cliquez sur **"Authentication"**

### 3.2. Configurer les URI de redirection

**URIs de redirection à ajouter :**

Pour le développement :
```
https://localhost:3000
```

Pour la production (ajoutez toutes vos URLs) :
```
https://votre-domaine.com
https://votre-org.crm.dynamics.com/WebResources/...
```

**Pour ajouter une URI :**
1. Sous "Single-page application", cliquez sur **"Add URI"**
2. Entrez l'URI
3. Cliquez sur **"Save"** en bas de la page

### 3.3. Configurer les paramètres avancés

Dans la section **"Advanced settings"** :

| Paramètre | Valeur | Description |
|-----------|---------|-------------|
| **Allow public client flows** | ❌ Non | Laisser désactivé pour SPA |
| **Enable the following mobile and desktop flows** | ❌ Non | Non nécessaire |

Dans la section **"Implicit grant and hybrid flows"** :

| Paramètre | Valeur | Raison |
|-----------|---------|---------|
| **Access tokens** | ✅ Oui | Nécessaire pour obtenir des access tokens |
| **ID tokens** | ✅ Oui | Nécessaire pour l'authentification OpenID Connect |

**⚠️ Important pour le SSO dans iframe :**

Sous **"Advanced settings"**, trouvez :

```
Allow public client flows: No
```

Et vérifiez que dans les paramètres additionnels :
- **Support for native client flows** : Non (désactivé)

4. Cliquez sur **"Save"** en bas de la page

## 🔓 Étape 4 : Configurer les permissions API

### 4.1. Accéder aux permissions API

1. Dans le menu de gauche, cliquez sur **"API permissions"**

### 4.2. Permissions par défaut

Par défaut, ces permissions sont déjà ajoutées :

- **Microsoft Graph** → `User.Read` (Delegated)

C'est suffisant pour lire le profil de l'utilisateur connecté.

### 4.3. Ajouter des permissions supplémentaires (optionnel)

Si vous avez besoin d'accéder à plus de données :

1. Cliquez sur **"+ Add a permission"**
2. Sélectionnez **"Microsoft Graph"**
3. Sélectionnez **"Delegated permissions"**
4. Ajoutez les permissions nécessaires :
   - `User.Read` : Lire le profil (déjà ajouté)
   - `profile` : Informations de profil de base
   - `email` : Adresse email
   - `openid` : Authentification OpenID Connect

5. Cliquez sur **"Add permissions"**

### 4.4. Consentement administrateur (si nécessaire)

Certaines permissions nécessitent le consentement d'un administrateur.

Si vous voyez "⚠️ Admin consent required" :

1. Demandez à un administrateur de cliquer sur **"Grant admin consent for [Organization]"**
2. Confirmez dans la popup

**Note :** `User.Read` ne nécessite généralement pas de consentement administrateur.

## 🔐 Étape 5 : Configuration pour Dynamics 365 (optionnel)

Si vous souhaitez accéder à l'API Dynamics 365 depuis votre application :

### 5.1. Ajouter l'API Dynamics 365

1. Allez dans **"API permissions"**
2. Cliquez sur **"+ Add a permission"**
3. Cliquez sur l'onglet **"APIs my organization uses"**
4. Recherchez et sélectionnez **"Dynamics CRM"**
5. Sélectionnez **"Delegated permissions"**
6. Cochez **"user_impersonation"**
7. Cliquez sur **"Add permissions"**

### 5.2. Scopes D365 dans votre configuration

Dans `config.js`, ajoutez les scopes D365 :

```javascript
const d365Config = {
    orgUrl: "https://votre-org.crm.dynamics.com",
    d365Scopes: ["https://votre-org.crm.dynamics.com/.default"]
};
```

## 📝 Étape 6 : Mettre à jour votre configuration MSAL

### 6.1. Créer le fichier de configuration

```bash
cp public/js/config.example.js public/js/config.js
```

### 6.2. Éditer public/js/config.js

Remplacez les valeurs suivantes :

```javascript
const msalConfig = {
    auth: {
        // ⬇️ Remplacez par votre Application (client) ID
        clientId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",

        // ⬇️ Remplacez par votre Directory (tenant) ID
        authority: "https://login.microsoftonline.com/yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",

        // ⬇️ URI de redirection (doit correspondre à Azure AD)
        redirectUri: "https://localhost:3000",

        postLogoutRedirectUri: "https://localhost:3000",
        navigateToLoginRequestUrl: false
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: true // ⚠️ Important pour IE11/Edge et iframe
    }
};
```

### 6.3. Configurer les scopes

```javascript
const loginRequest = {
    scopes: ["user.read", "openid", "profile", "email"]
};
```

## ✅ Étape 7 : Tester la configuration

### 7.1. Démarrer l'application

```bash
npm start
```

### 7.2. Ouvrir dans le navigateur

Ouvrez https://localhost:3000

### 7.3. Tester l'authentification

1. Cliquez sur "Se connecter"
2. Une popup Microsoft s'ouvre
3. Connectez-vous avec votre compte Microsoft/Azure AD
4. Acceptez les permissions demandées
5. La popup se ferme
6. Vous devriez voir vos informations utilisateur

### 7.4. Vérifier les logs

Ouvrez la console du navigateur (F12) et vérifiez les logs :

```
Initialisation de MSAL...
MSAL initialisé avec succès
Tentative d'authentification silencieuse (SSO)...
Authentification SSO réussie
```

## 🔧 Configuration avancée

### Authentification multi-tenant

Si votre application doit supporter plusieurs organisations :

```javascript
authority: "https://login.microsoftonline.com/common"
```

Options :
- `common` : Tous les comptes Microsoft et Azure AD
- `organizations` : Uniquement les comptes Azure AD (toutes organisations)
- `consumers` : Uniquement les comptes Microsoft personnels
- `{tenant-id}` : Une organisation spécifique

### Personnalisation du prompt

```javascript
const loginRequest = {
    scopes: ["user.read"],
    prompt: "select_account" // Options: "login", "select_account", "consent", "none"
};
```

### Timeout réseau

```javascript
system: {
    networkTimeout: 10000, // 10 secondes
    loadFrameTimeout: 6000
}
```

## 🐛 Problèmes courants

### "AADSTS50011: The reply URL specified in the request does not match"

**Cause :** L'URI de redirection ne correspond pas à celle configurée dans Azure AD.

**Solution :**
1. Vérifiez que l'URI dans Azure AD est exactement la même que dans `config.js`
2. Vérifiez le protocole (http vs https)
3. Vérifiez le port
4. Pas de slash final dans l'URI

### "AADSTS65001: The user or administrator has not consented"

**Cause :** Les permissions n'ont pas été acceptées.

**Solution :**
1. Acceptez les permissions lors de la première connexion
2. Ou demandez à un administrateur de donner son consentement

### L'authentification silencieuse échoue toujours

**Cause :** Cookies tiers bloqués ou mauvaise configuration.

**Solution :**
1. Vérifiez que `storeAuthStateInCookie: true`
2. Autorisez les cookies tiers pour `login.microsoftonline.com`
3. Utilisez HTTPS (requis pour MSAL)

## 📚 Ressources supplémentaires

### Documentation Microsoft

- [Azure AD App Registration](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [MSAL.js Configuration](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md)
- [OAuth 2.0 Authorization Code Flow with PKCE](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

### Outils utiles

- **Azure AD Graph Explorer** : https://developer.microsoft.com/en-us/graph/graph-explorer
- **JWT Decoder** : https://jwt.ms
- **MSAL.js Samples** : https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/samples

## 🔄 Prochaines étapes

Une fois Azure AD configuré :

1. ✅ Testez l'authentification localement
2. 📱 Consultez [D365_INTEGRATION.md](D365_INTEGRATION.md) pour l'intégration dans Dynamics 365
3. 🚀 Déployez en production
4. 🔒 Sécurisez votre application

---

**Besoin d'aide ?** Consultez [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
