#!/bin/sh
set -eu

npm run profile:install
exec dsh "$@"
