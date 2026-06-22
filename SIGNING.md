# 🔏 Signature de code (SignPath, gratuit pour l'open-source)

L'installeur est signé automatiquement lors d'une **Release GitHub**, via
[SignPath Foundation](https://signpath.org/open-source) qui offre la signature
de code aux projets open-source. La signature permet à Windows de **construire
la réputation** de l'éditeur au fil des téléchargements (l'avertissement
SmartScreen s'estompe avec le temps).

> ℹ️ Tant que les secrets ci-dessous ne sont pas configurés, le workflow publie
> quand même une Release, mais **non signée** (l'app reste 100 % fonctionnelle).

## Mise en place (une seule fois)

### 1. Créer le compte et demander le parrainage OSS
1. Inscris-toi sur **https://app.signpath.io** (plan **Open Source**, gratuit).
2. Demande le parrainage SignPath Foundation en pointant ce dépôt GitHub
   (`StrangeLex/33immortals-overlay`). Un certificat OSS est fourni après
   validation (quelques jours).

### 2. Configurer le projet dans SignPath
1. **Connecte le dépôt GitHub** (Integrations → GitHub).
2. Crée un **Project** avec le slug exact **`33immortals-overlay`**.
3. Crée une **Signing Policy** avec le slug exact **`33_immortals_Overlay`**.
4. Configure un **Artifact** de type *exe/zip* correspondant à l'installeur.
5. Crée un **CI user** + un **API token**.

> ⚠️ Les slugs `project-slug` et `signing-policy-slug` dans
> [`.github/workflows/release.yml`](.github/workflows/release.yml) **doivent
> correspondre** à ceux créés ici.

### 3. Ajouter les secrets GitHub
Dans le dépôt → **Settings → Secrets and variables → Actions → New repository secret** :

| Secret | Valeur |
|---|---|
| `SIGNPATH_API_TOKEN` | le jeton API du CI user SignPath |
| `SIGNPATH_ORGANIZATION_ID` | l'ID de ton organisation SignPath |

## Publier une version signée

```bash
# 1. bump la version dans package.json (ex. 1.0.8 → 1.0.9)
# 2. commit
git commit -am "release: v1.0.9"
# 3. tag + push  → déclenche le workflow Release (build → SignPath → Release GitHub)
git tag v1.0.9
git push origin main --tags
```

Le workflow :
1. compile l'installeur (`electron-builder`),
2. l'envoie à SignPath pour signature,
3. **régénère `latest.yml`** depuis l'exe signé (checksum correct pour l'auto-update),
4. publie la **Release GitHub** (installeur + `latest.yml`).

Les utilisateurs installés se mettent à jour automatiquement depuis cette Release
(provider `github` configuré dans `package.json`).

## Alternative : suppression *immédiate* de l'avertissement
Seul un **certificat EV** supprime SmartScreen dès le 1ᵉʳ jour, mais il exige une
**société** et coûte ~300–500 €/an. SignPath (OV) est gratuit mais la réputation
se construit progressivement.
