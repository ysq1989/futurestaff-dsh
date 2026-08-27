#!/bin/sh
set -eu

npm run profile:install

if [ -n "${DSH_TRUSTED_HOST:-}" ]; then
  set -- "$@" --trusted-host "$DSH_TRUSTED_HOST"
fi

exec dsh "$@"
