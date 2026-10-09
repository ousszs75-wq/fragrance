# Amine Parfumerie 31 — Vercel + Supabase

1. Supabase : exécuter `supabase.sql` (éditeur SQL). Les tables sont privées (RLS sans politique publique).
2. Supabase → Project Settings → API : copier l’URL du projet et la clé secrète « service_role ».
3. Vercel → Settings → Environment Variables (Production) :
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (secrète, jamais dans le navigateur)
   - `ADMIN_CODE` = code d’accès admin
   - `SESSION_SECRET` = longue chaîne aléatoire (32+ caractères)
4. Déployer ce dossier.

Stock : le client ne reçoit que « Disponible / Non disponible ». La quantité n’est envoyée qu’à l’admin connecté.
Le stock ne se décrémente pas tout seul : l’admin le met à jour après avoir confirmé une commande.
