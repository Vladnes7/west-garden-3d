#!/bin/sh
# Publish dist/ to the gh-pages branch (GitHub Pages mirror: reachable where *.vercel.app is blocked).
set -e
cd "$(dirname "$0")/.."
npm run build >/dev/null
URL=$(git remote get-url origin)
TMP=$(mktemp -d)
cp -R dist/. "$TMP"/
touch "$TMP/.nojekyll"
AN=$(git log -1 --format=%an); AE=$(git log -1 --format=%ae)
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$AN" -c user.email="$AE" commit -q -m "Pages build $(date '+%Y-%m-%d %H:%M')"
git push -q -f "$URL" gh-pages
cd / && rm -rf "$TMP"
echo "published gh-pages"
