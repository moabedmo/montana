#!/bin/sh
# Push this tree to moabedmo/montana:live.
#
# gh holds several accounts on this machine and only one is active at a time.
# The active one decides whether the push succeeds, and it drifts on its own —
# montanahala32, xmoshamsx-cpu and mahrandevelopment-boop have each been active
# when a push was attempted, and every time it came back 403.
#
# The other accounts belong to other projects on this same machine, so nothing
# here logs anything out. It asks which account to push as, and says which one
# is active when it finishes, so a switch is never silent.
#
# Run it as: git publish

set -e

REPO="https://github.com/moabedmo/montana.git"
BRANCH="live"
DEFAULT="moabedmo"

echo "الحسابات المسجّلة:"
gh auth status 2>&1 | sed -n 's/.*Logged in to github.com account \([^ ]*\).*/  \1/p'

ACTIVE=$(gh api user --jq .login 2>/dev/null || echo "?")
echo "النشط دلوقتي: $ACTIVE"
echo

printf "تنشر بأي حساب؟ [%s] " "$DEFAULT"
# `|| true`: with no terminal attached read hits EOF and would abort under
# `set -e` at the prompt, having pushed nothing and said nothing about why.
read -r USER || true
[ -z "$USER" ] && USER="$DEFAULT"
echo "$USER"

if [ "$USER" != "$ACTIVE" ]; then
  gh auth switch --user "$USER"
fi

echo
git push "$REPO" "HEAD:$BRANCH"
echo
echo "الحساب النشط دلوقتي: $(gh api user --jq .login 2>/dev/null || echo '?')"
