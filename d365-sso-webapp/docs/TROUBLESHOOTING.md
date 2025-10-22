# Guide de dépannage

Ce guide recense les problèmes courants et leurs solutions pour l'intégration de l'authentification SSO Microsoft dans Dynamics 365.

## 📑 Table des matières

- [Problèmes d'authentification](#problèmes-dauthentification)
- [Problèmes CORS](#problèmes-cors)
- [Problèmes d'iframe](#problèmes-diframe)
- [Problèmes de cookies](#problèmes-de-cookies)
- [Problèmes de certificat SSL](#problèmes-de-certificat-ssl)
- [Problèmes de configuration](#problèmes-de-configuration)
- [Problèmes spécifiques aux navigateurs](#problèmes-spécifiques-aux-navigateurs)

---

## Problèmes d'authentification

### ❌ "AADSTS50011: The reply URL specified in the request does not match"

**Erreur complète :**
```
AADSTS50011: The reply URL specified in the request does not match
the reply URLs configured for the application
```

**Cause :**
L'URI de redirection dans votre application ne correspond pas à celle configurée dans Azure AD.

**Solutions :**

1. **Vérifiez l'URI exacte dans config.js :**
   ```javascript
   redirectUri: "https://localhost:3000"  // Doit être exactement la même
   ```

2. **Vérifiez dans Azure AD :**
   - Portail Azure → App Registration → Authentication
   - Vérifiez que l'URI est bien dans "Single-page application"
   - ⚠️ Attention à :
     - Protocole (http vs https)
     - Port (3000 vs 3001)
     - Slash final (`/` à la fin ou non)
     - Casse (majuscules/minuscules)

3. **Format correct :**
   ```
   ✅ https://localhost:3000
   ❌ http://localhost:3000     (protocole différent)
   ❌ https://localhost:3000/   (slash final)
   ❌ https://127.0.0.1:3000    (adresse différente)
   ```

---

### ❌ "AADSTS65001: The user or administrator has not consented"

**Erreur complète :**
```
AADSTS65001: The user or administrator has not consented to use the application
```

**Cause :**
Les permissions demandées par l'application n'ont pas été acceptées.

**Solutions :**

1. **Consentement utilisateur (première connexion) :**
   - Lors de la première connexion, acceptez les permissions demandées
   - Cochez "Consentir au nom de votre organisation" si disponible

2. **Consentement administrateur :**
   - Portail Azure → App Registration → API permissions
   - Cliquez sur "Grant admin consent for [Organization]"
   - Confirmez

3. **Vérifiez les scopes demandés :**
   ```javascript
   // Scopes de base qui ne nécessitent généralement pas de consentement admin
   const loginRequest = {
       scopes: ["user.read", "openid", "profile"]
   };
   ```

---

### ❌ L'authentification silencieuse échoue toujours

**Symptômes :**
- Le SSO ne fonctionne jamais
- Une popup s'ouvre à chaque fois
- Message : "Interaction required"

**Causes possibles :**

1. **Cookies tiers bloqués**
2. **Configuration MSAL incorrecte**
3. **Pas de session active**

**Solutions :**

#### Solution 1 : Activer storeAuthStateInCookie

```javascript
cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: true  // ⚠️ Important!
}
```

#### Solution 2 : Autoriser les cookies tiers

**Chrome :**
1. Paramètres → Confidentialité et sécurité
2. Cookies et autres données des sites
3. Choisir "Autoriser tous les cookies" ou ajouter `login.microsoftonline.com` aux exceptions

**Edge :**
1. Paramètres → Cookies et autorisations du site
2. Gérer et supprimer les cookies et les données de site
3. Désactiver "Bloquer les cookies tiers"

**Firefox :**
1. Paramètres → Vie privée et sécurité
2. Protection renforcée contre le pistage : Standard

#### Solution 3 : Vérifier l'autorité (authority)

```javascript
authority: "https://login.microsoftonline.com/{tenant-id}"  // Tenant spécifique
// ou
authority: "https://login.microsoftonline.com/organizations" // Tous les comptes AAD
```

#### Solution 4 : Activer allowRedirectInIframe

```javascript
system: {
    allowRedirectInIframe: true  // Permet l'authentification dans iframe
}
```

---

### ❌ "BrowserAuthError: interaction_in_progress"

**Erreur complète :**
```
BrowserAuthError: interaction_in_progress: Interaction is currently in progress
```

**Cause :**
Une tentative d'authentification est déjà en cours.

**Solutions :**

1. **Éviter les appels multiples :**
   ```javascript
   // ❌ Mauvais
   authManager.signIn();
   authManager.signIn(); // Deuxième appel avant que le premier soit terminé

   // ✅ Bon
   if (!authManager.isSigningIn) {
       await authManager.signIn();
   }
   ```

2. **Nettoyer le cache :**
   ```javascript
   // Effacer le cache MSAL
   localStorage.clear();
   sessionStorage.clear();
   // Recharger la page
   location.reload();
   ```

---

## Problèmes CORS

### ❌ "Access to fetch has been blocked by CORS policy"

**Erreur complète :**
```
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Cause :**
Le serveur backend ne permet pas les requêtes depuis votre domaine.

**Solutions :**

#### Solution 1 : Configurer CORS côté serveur (Node.js/Express)

```javascript
const cors = require('cors');

app.use(cors({
    origin: [
        'https://localhost:3000',
        'https://votre-org.crm.dynamics.com',
        'https://votre-domaine.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

#### Solution 2 : Headers manuels

```javascript
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});
```

#### Solution 3 : Azure App Service (configuration)

Dans le portail Azure :
1. App Service → CORS
2. Ajoutez vos origines autorisées :
   - `https://localhost:3000`
   - `https://votre-org.crm.dynamics.com`
3. Cochez "Enable Access-Control-Allow-Credentials" si nécessaire

---

## Problèmes d'iframe

### ❌ L'iframe ne charge pas dans D365

**Symptômes :**
- Page blanche dans l'iframe
- Erreur "Refused to display in a frame"

**Cause :**
Headers de sécurité qui bloquent l'affichage dans un iframe.

**Solutions :**

#### Solution 1 : Configurer X-Frame-Options

```javascript
// Node.js/Express
app.use((req, res, next) => {
    // Option 1: Autoriser tous les domaines (développement uniquement)
    res.setHeader('X-Frame-Options', 'ALLOWALL');

    // Option 2: Autoriser un domaine spécifique (production)
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://votre-org.crm.dynamics.com');

    next();
});
```

#### Solution 2 : Utiliser Content-Security-Policy

```javascript
// Remplace X-Frame-Options (moderne)
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://votre-org.crm.dynamics.com");
    next();
});
```

#### Solution 3 : Désactiver X-Frame-Options (Azure App Service)

Dans `web.config` :

```xml
<system.webServer>
    <httpProtocol>
        <customHeaders>
            <remove name="X-Frame-Options" />
            <add name="Content-Security-Policy" value="frame-ancestors *" />
        </customHeaders>
    </httpProtocol>
</system.webServer>
```

---

### ❌ Xrm n'est pas disponible dans l'iframe

**Symptômes :**
```javascript
d365ContextManager.isInD365 === false
```

**Cause :**
Le contexte D365 n'est pas accessible depuis l'iframe.

**Solutions :**

1. **Vérifier la restriction entre origines multiples :**
   - Dans les propriétés de la Web Resource dans D365
   - Désactiver "Restrict cross-frame scripting"

2. **Accéder au parent.Xrm :**
   ```javascript
   // Essayer plusieurs méthodes
   var Xrm = window.Xrm || window.parent.Xrm || window.top.Xrm;

   if (Xrm && Xrm.Page) {
       console.log("Contexte D365 trouvé");
   }
   ```

3. **Passer les données via l'URL :**
   ```javascript
   // Dans la Web Resource HTML
   var entityId = Xrm.Page.data.entity.getId();
   iframe.src = `https://votre-app.com?entityId=${entityId}`;
   ```

---

## Problèmes de cookies

### ❌ Cookies tiers bloqués

**Symptômes :**
- SSO ne fonctionne pas dans l'iframe D365
- Popup d'authentification à chaque fois
- Erreur dans la console liée aux cookies

**Cause :**
Les navigateurs modernes bloquent les cookies tiers par défaut pour la vie privée.

**Impact :**
- Chrome 80+ : Cookies SameSite=None requis
- Safari : ITP (Intelligent Tracking Prevention)
- Firefox : ETP (Enhanced Tracking Protection)

**Solutions :**

#### Solution 1 : Configuration MSAL

```javascript
cache: {
    cacheLocation: "sessionStorage",  // Pas dans les cookies
    storeAuthStateInCookie: true      // Mais stocke l'état dans les cookies
}
```

#### Solution 2 : Cookies SameSite=None (backend)

```javascript
// Node.js/Express
app.use(session({
    cookie: {
        sameSite: 'none',
        secure: true,  // HTTPS obligatoire
        httpOnly: true
    }
}));
```

#### Solution 3 : Utiliser localStorage au lieu de cookies

```javascript
cache: {
    cacheLocation: "localStorage",  // Plus permissif que sessionStorage
    storeAuthStateInCookie: false
}
```

⚠️ **Note :** `localStorage` persiste entre les sessions, ce qui peut être un risque de sécurité.

#### Solution 4 : Instructions pour les utilisateurs

**Chrome / Edge :**
1. `chrome://settings/cookies`
2. "Autoriser tous les cookies"
3. Ou ajouter `[*.]login.microsoftonline.com` aux sites autorisés

**Safari :**
1. Préférences → Confidentialité
2. Décocher "Empêcher le suivi sur plusieurs domaines"

---

## Problèmes de certificat SSL

### ❌ "NET::ERR_CERT_AUTHORITY_INVALID"

**Cause :**
Certificat SSL auto-signé en développement.

**Solutions :**

#### Solution 1 : Accepter le certificat (développement)

1. Allez sur `https://localhost:3000`
2. Cliquez sur "Avancé" ou "Paramètres avancés"
3. Cliquez sur "Continuer vers le site"

#### Solution 2 : Ajouter le certificat aux certificats de confiance

**Windows :**
```bash
# Importer le certificat dans le magasin de certificats
certutil -addstore -f "ROOT" server.crt
```

**macOS :**
```bash
# Ajouter au trousseau
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain server.crt
```

**Linux :**
```bash
# Copier dans les certificats de confiance
sudo cp server.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

#### Solution 3 : Utiliser mkcert (recommandé)

```bash
# Installer mkcert
brew install mkcert    # macOS
choco install mkcert   # Windows

# Créer une autorité de certification locale
mkcert -install

# Générer des certificats
mkcert localhost 127.0.0.1 ::1

# Utiliser dans server.js
const credentials = {
    key: fs.readFileSync('localhost-key.pem'),
    cert: fs.readFileSync('localhost.pem')
};
```

---

### ❌ "SSL protocol error" dans l'iframe

**Cause :**
Mélange de contenu HTTP et HTTPS (Mixed Content).

**Solutions :**

1. **Tout en HTTPS :**
   - Application principale : HTTPS ✅
   - Iframe : HTTPS ✅
   - API backend : HTTPS ✅

2. **Forcer HTTPS :**
   ```javascript
   // Rediriger automatiquement vers HTTPS
   if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
       location.replace(`https:${location.href.substring(location.protocol.length)}`);
   }
   ```

---

## Problèmes de configuration

### ❌ "Configuration MSAL non trouvée"

**Symptômes :**
```
Configuration MSAL non trouvée. Veuillez copier config.example.js en config.js
```

**Cause :**
Le fichier `config.js` n'existe pas ou n'est pas chargé.

**Solutions :**

1. **Créer le fichier :**
   ```bash
   cp public/js/config.example.js public/js/config.js
   ```

2. **Vérifier le chargement dans index.html :**
   ```html
   <!-- L'ordre est important! -->
   <script src="js/config.js"></script>         <!-- ⬅️ En premier -->
   <script src="js/auth.js"></script>
   <script src="js/d365-context.js"></script>
   <script src="js/app.js"></script>
   ```

3. **Vérifier le chemin :**
   - Le fichier doit être dans `public/js/config.js`
   - Accessible via `https://localhost:3000/js/config.js`

---

### ❌ "Configuration MSAL non configurée"

**Symptômes :**
```
Configuration MSAL non configurée. Veuillez modifier config.js avec vos identifiants Azure AD
```

**Cause :**
Les placeholders n'ont pas été remplacés.

**Solutions :**

Éditez `public/js/config.js` :

```javascript
// ❌ Avant (valeurs par défaut)
clientId: "VOTRE_CLIENT_ID_ICI",
authority: "https://login.microsoftonline.com/VOTRE_TENANT_ID_ICI",

// ✅ Après (valeurs réelles)
clientId: "12345678-1234-1234-1234-123456789abc",
authority: "https://login.microsoftonline.com/87654321-4321-4321-4321-abcdef123456",
```

---

## Problèmes spécifiques aux navigateurs

### Chrome / Edge

#### Problème : Cookies SameSite

**Erreur :**
```
A cookie associated with a cross-site resource was set without the SameSite attribute
```

**Solution :**
Configurez `storeAuthStateInCookie: true` dans MSAL config.

---

### Safari

#### Problème : ITP (Intelligent Tracking Prevention)

**Symptômes :**
- SSO ne fonctionne jamais
- Cookies supprimés après 24h

**Solutions :**

1. **Utiliser localStorage :**
   ```javascript
   cache: {
       cacheLocation: "localStorage"
   }
   ```

2. **First-party context :**
   - Hébergez l'application sur le même domaine que D365 (difficile)
   - Ou utilisez une Web Resource intégrée

---

### Firefox

#### Problème : ETP (Enhanced Tracking Protection)

**Symptômes :**
- Cookies de login.microsoftonline.com bloqués

**Solution :**

1. **Désactiver ETP pour le site :**
   - Cliquez sur le bouclier dans la barre d'adresse
   - Désactiver la protection pour ce site

2. **Ou passer en mode Standard :**
   - Paramètres → Vie privée et sécurité
   - Choisir "Standard"

---

## Outils de diagnostic

### 1. Console du navigateur (F12)

**Logs MSAL :**
```javascript
// Activer les logs détaillés
system: {
    loggerOptions: {
        logLevel: msal.LogLevel.Verbose
    }
}
```

### 2. Network tab

- Vérifiez les requêtes vers `login.microsoftonline.com`
- Vérifiez les codes de réponse HTTP
- Vérifiez les headers CORS

### 3. Application tab

- Vérifiez les cookies
- Vérifiez localStorage / sessionStorage
- Recherchez les clés commençant par `msal.`

### 4. JWT Decoder

Décodez vos tokens sur https://jwt.ms pour vérifier :
- Expiration (`exp`)
- Audience (`aud`)
- Issuer (`iss`)
- Scopes (`scp`)

### 5. MSAL Browser Sample

Testez avec l'exemple officiel pour isoler le problème :
https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/samples/msal-browser-samples

---

## Commandes de débogage

### Effacer tout le cache MSAL

```javascript
// Dans la console du navigateur
localStorage.clear();
sessionStorage.clear();
// Puis recharger
location.reload();
```

### Récupérer les comptes MSAL

```javascript
// Dans la console
const accounts = authManager.msalInstance.getAllAccounts();
console.log("Comptes:", accounts);
```

### Forcer l'acquisition d'un nouveau token

```javascript
// Dans la console
const token = await authManager.getAccessToken();
console.log("Token:", token);
```

---

## Checklist de dépannage

Avant de demander de l'aide, vérifiez :

- [ ] L'application fonctionne en HTTPS
- [ ] Le certificat SSL est accepté
- [ ] Azure AD App Registration est créée
- [ ] Les Redirect URIs sont configurés correctement
- [ ] Le fichier config.js existe et est configuré
- [ ] Les cookies tiers sont autorisés
- [ ] La console ne montre pas d'erreurs CORS
- [ ] Les permissions API sont acceptées
- [ ] L'application charge bien dans le navigateur
- [ ] Les logs MSAL sont activés

---

## Obtenir de l'aide

Si les solutions ci-dessus ne résolvent pas votre problème :

1. **Vérifiez les logs** dans la console (F12)
2. **Recherchez l'erreur exacte** dans ce guide
3. **Consultez la documentation officielle** MSAL.js
4. **Ouvrez une issue** sur GitHub avec :
   - Description du problème
   - Message d'erreur complet
   - Configuration (sans les secrets!)
   - Étapes pour reproduire

---

## Ressources supplémentaires

- [MSAL.js FAQ](https://github.com/AzureAD/microsoft-authentication-library-for-js/wiki/FAQ)
- [Azure AD Error Codes](https://docs.microsoft.com/en-us/azure/active-directory/develop/reference-aadsts-error-codes)
- [MSAL.js Samples](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/samples)
- [Stack Overflow - msal.js tag](https://stackoverflow.com/questions/tagged/msal.js)
