# Amine Parfumerie 31 — Vercel + Supabase

## Pages
- `/` : boutique (clair / sombre, FR / AR, filtres, panier, commande).
- `/admin` : administration séparée (aucun lien depuis la boutique). Statistiques, commandes, parfums, stock, livraison.

## Mise en place
1. Supabase → éditeur SQL : exécuter `supabase.sql` (idempotent : vous pouvez ne relancer que le bloc `orders`).
   Les tables sont privées (RLS sans politique publique).
2. Supabase → Project Settings → API : copier l’URL du projet et la clé secrète « service_role ».
3. Vercel → Settings → Environment Variables (Production) :
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (secrète, jamais dans le navigateur)
   - `ADMIN_CODE` = code d’accès admin
   - `SESSION_SECRET` = longue chaîne aléatoire (32+ caractères)
4. Déployer ce dossier (redéployer après avoir remplacé les fichiers).

## Commandes
Le client remplit nom, téléphone, wilaya, commune, mode (domicile / bureau), adresse. La commande arrive dans `/admin` → Commandes.
Les prix et le tarif de livraison sont recalculés côté serveur (le navigateur ne peut pas les modifier).
Stock : déduit automatiquement quand vous passez la commande en « Confirmée », restitué si vous l’annulez.

## Livraison
`/admin` → Livraison : tarif par wilaya (69), domicile et bureau séparés. Case vide = « à confirmer » côté client.

## Stock
Pièce = « Flacon complet ». Dose = contenance en ml. Le client voit seulement Disponible / Non disponible.

## Fichiers de données
`dz-data.js` : 69 wilayas et 1 541 communes (noms FR + AR).
