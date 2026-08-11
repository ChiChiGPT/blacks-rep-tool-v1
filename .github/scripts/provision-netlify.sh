#!/usr/bin/env bash
set -euo pipefail
status=$(curl --silent --output /dev/null --write-out '%{http_code}' --header "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" https://api.netlify.com/api/v1/sites)
printf '%s\n' "$status"
test "$status" = "200"
response=$(curl --fail --silent --show-error --request POST --header "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" --header "Content-Type: application/json" --data '{"name":"blacks-rep-tool-v1","account_slug":"craigmcgeown1"}' https://api.netlify.com/api/v1/sites)
site_id=$(printf '%s' "$response" | jq -er '.id')
printf 'NETLIFY_SITE_ID=%s\n' "$site_id"
