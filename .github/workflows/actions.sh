# ACTIONS.SH is a simple task runner
#
# "Import" it by including this line at the top of your action script:
#
#   source "$(dirname "$0")/actions.sh"
#
# To run a step, call the step function with a command:
#
#   step run: "echo Hello, world!"
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
# - `env:` sets environment variables:
#
#     step "Greet" \
#       run: "echo Hello, \$NAME!" \
#       env: "NAME=jake"
#
#   (Make sure to escape variable names, or it'll use variables from your action script instead.)
#
# - `dir:` sets the working directory:
#
#     step "ls" \
#       run: "ls" \
#       dir: "./src"
#
# Custom action functions can be used with `use:`:
#
#   step "Custom function" \
#     use: my_function \
#     arg1: "value1" \
#     arg2: "value2"
#
# The function receives key-value pairs as positional args:
#
#   my_function() {
#     while [ $# -gt 0 ]; do
#       case "$1" in
#         arg1) echo "$2"; shift 2 ;;
#         arg2) echo "$2"; shift 2 ;;
#         *)    shift 2 ;;
#       esac
#     done
#   }

#!/bin/bash
set -uo pipefail

_steps=() # the step names
_calls=() # the full commands of each step

trap _exec EXIT # run the `_exec` function on exit

# add a step to _steps and _calls
step() {
  local name=""

  # if there's more than one argument and the first argument doesn't end in :, it's the step name
  if [[ $# -gt 0 ]] && [[ "$1" != *: ]]; then
    name="$1"
    shift
  fi

  local fn="" fn_arg=""
  local -a args=()

  # iterate through the arguments to build up the call
  while [ $# -gt 0 ]; do
    case "$1" in
      # if the keyword is `run:`, set fn to the special _run function and fn_arg to the next arg
      run:) fn="_run"; fn_arg="$2"; shift 2 ;;
      # if the keyword is `use:`, set fn to the next arg
      use:) fn="$2"; shift 2 ;;
      *:)   args+=("${1%:}" "$2"); shift 2 ;;
      *)    shift ;;
    esac
  done

  # if name isn't defined, set it to fn_arg; if that's also not defined, set it to fn
  [ -z "$name" ] && name="${fn_arg:-$fn}"

  # append the name to the steps
  _steps+=("$name")

  # create the function call
  local -a call=("$fn")
  [ -n "$fn_arg" ] && call+=("$fn_arg") # if fn_arg is defined, append it to the call
  [ ${#args[@]} -gt 0 ] && call+=("${args[@]}") # append any args to the call
  _calls+=("$(printf '%q ' "${call[@]}")") # append the call to the _calls list
}

# a special action that executes a bash command
_run() {
  local cmd="$1"
  shift

  local step_env="" step_dir=""
  while [ $# -gt 0 ]; do
    case "$1" in
      env) step_env="$2"; shift 2 ;;
      dir) step_dir="$2"; shift 2 ;;
      *)   shift 2 ;;
    esac
  done

  [ -n "$step_dir" ] && cd "$step_dir"
  [ -n "$step_env" ] && export $step_env
  eval "$cmd"
}

# execute the steps
_exec() {
  trap - EXIT
  set +e
  local failed=0
  local i

  # loop through and execute the steps
  for i in "${!_steps[@]}"; do
    local output start elapsed

    # print the name of the step (followed by a carriage return, to overwrite it with the result)
    printf '\033[2m⋯ %s\033[0m\r' "${_steps[$i]}"

    # record the start time
    start=$SECONDS

    # run the step function and get the return code
    output=$(set -e; eval "${_calls[$i]}" 2>&1)
    local rc=$?

    # find the elapsed time
    elapsed=$(( SECONDS - start ))

    # if the step succeeded...
    if [ $rc -eq 0 ]; then
      # print the success message
      printf '\033[32m✓ %s\033[0m \033[2m(%ds)\033[0m\n' "${_steps[$i]}" "$elapsed"

      # if `RUNNER_DEBUG` = 1, print the output
      [ "${RUNNER_DEBUG-}" = "1" ] && [ -n "$output" ] && printf '%s\n' "$output"

    # if the step failed...
    else
      # print the failure message and the output
      printf '\033[31m✗ %s\033[0m \033[2m(%ds)\033[0m\n' "${_steps[$i]}" "$elapsed"
      printf '%s\n' "$output"

      # flag that we've failed and exit the loop
      failed=1
      break
    fi
  done

  # loop through any remaining steps to print that they've been skipped
  for ((i=i+1; i<${#_steps[@]}; i++)); do
    printf '\033[2m- %s (skipped)\033[0m\n' "${_steps[$i]}"
  done

  # return whether all the steps ran successfully
  exit $failed
}

# BUILT-IN ACTIONS

# deploy to cloudflare with wrangler
#   step \
#     use: wrangler/deploy \
#     apiToken: "$CLOUDFLARE_API_TOKEN" \
#     accountId: "$CLOUDFLARE_ACCOUNT_ID" \
#     env: "prod" \
#     dir: "web"
wrangler/deploy() {
  local env="" dir="." api_token="" account_id=""
  while [ $# -gt 0 ]; do
    case "$1" in
      env) env="$2"; shift 2 ;;
      dir)         dir="$2"; shift 2 ;;
      apiToken)    api_token="$2"; shift 2 ;;
      accountId)   account_id="$2"; shift 2 ;;
      *)           shift 2 ;;
    esac
  done

  local env_flag=""
  [ -n "$env" ] && env_flag="--env $(printf '%q' "$environment")"

  cd "$dir"
  CLOUDFLARE_API_TOKEN="$api_token" \
  CLOUDFLARE_ACCOUNT_ID="$account_id" \
    npx wrangler deploy $env_flag
}
