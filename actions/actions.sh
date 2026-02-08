# ACTIONS.SH is a simple task runner
#
# "Import" it by including this line at the top of your action script:
#
#   source "$(dirname "$0")/actions.sh"
#
# To run a step, call the step function with a command:
#
#   step "echo Hello, world!"
#
# By default, a step will use the command as its name.
# A step can also be given an explicit name:
#
#   step "Greet" \
#     run: "echo Hello, world!"
#
# To run multiple commands in a step, use a multiline string:
#
#   step "Greet" \
#     run: "
#       echo Hello, world!
#       echo How are you?
#     "
#
# Steps support other arguments as well:
# - `env` sets environment variables:
#
#     step "Greet" \
#       run: "echo Hello, \$NAME!" \
#       env: "NAME=jake"
#
#   (Make sure to escape variable names, or it'll use variables from your action script instead.)
#
# - `dir` sets the working directory:
#
#     step "ls" \
#       dir: "./src"

#!/bin/bash
set -uo pipefail

_steps=()
_cmds=()
_envs=()
_dirs=()

trap run EXIT

step() {
  local name="$1" cmd="$1" env="" dir=""
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      run:) cmd="$2"; shift 2 ;;
      env:) env="$2"; shift 2 ;;
      dir:) dir="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  _steps+=("$name")
  _cmds+=("$cmd")
  _envs+=("$env")
  _dirs+=("$dir")
}

run() {
  local failed=0
  local i

  for i in "${!_steps[@]}"; do
    printf '\033[2m⋯ %s\033[0m\r' "${_steps[$i]}"
    local output start elapsed
    start=$SECONDS
    local dir=""
    [ -n "${_dirs[$i]}" ] && dir="cd ${_dirs[$i]} && "
    output=$(env ${_envs[$i]} bash -c "set -ueo pipefail; ${dir}${_cmds[$i]}" 2>&1)
    local rc=$?
    elapsed=$(( SECONDS - start ))
    if [ $rc -eq 0 ]; then
      printf '\033[32m✓ %s\033[0m \033[2m(%ds)\033[0m\n' "${_steps[$i]}" "$elapsed"
      [ "${RUNNER_DEBUG-}" = "1" ] && [ -n "$output" ] && printf '%s\n' "$output"
    else
      printf '\033[31m✗ %s\033[0m \033[2m(%ds)\033[0m\n' "${_steps[$i]}" "$elapsed"
      printf '%s\n' "$output"
      failed=1
      break
    fi
  done

  for ((i=i+1; i<${#_steps[@]}; i++)); do
    printf '\033[2m- %s (skipped)\033[0m\n' "${_steps[$i]}"
  done
}
