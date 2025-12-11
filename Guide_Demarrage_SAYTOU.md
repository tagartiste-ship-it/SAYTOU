# Guide de démarrage rapide SAYTOU

## 1. Chemin du projet

```text
C:\Users\HP\CascadeProjects\saytou
```

## 2. Démarrer SAYTOU (frontend + backend)

1. Ouvrir **Windows PowerShell**.
2. Lancer les commandes suivantes :

```powershell
cd C:\Users\HP\CascadeProjects\saytou
npm run dev
```

- Cette commande démarre **le backend** (API) et **le frontend** en même temps.
- Dans le terminal, Vite indique l’URL du frontend, par exemple :
  - `http://localhost:5174/`

3. Ouvrir un navigateur et aller sur l’URL indiquée (en général : `http://localhost:5174`).

---

## 3. Arrêter l’application

Dans le terminal où `npm run dev` tourne :

- Appuyer sur `Ctrl + C`.
- Confirmer si PowerShell demande l’arrêt du processus.

---

## 4. Créer un raccourci sur le Bureau (optionnel)

Pour ouvrir un terminal déjà positionné dans le projet SAYTOU :

1. Sur le **Bureau** → clic droit → **Nouveau** → **Raccourci**.
2. Dans **Emplacement de l’élément**, saisir :

```text
powershell.exe -NoExit -Command "cd C:\\Users\\HP\\CascadeProjects\\saytou"
```

3. Cliquer sur **Suivant**, nommer le raccourci (par exemple `SAYTOU Terminal`) puis **Terminer**.

À l’usage :

1. Double-cliquer sur le raccourci `SAYTOU Terminal`.
2. Dans la fenêtre qui s’ouvre, taper simplement :

```powershell
npm run dev
```

L’application SAYTOU sera alors disponible dans le navigateur.
