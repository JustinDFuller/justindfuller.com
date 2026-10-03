#!/usr/bin/env bash
set -euo pipefail

profile_name=""
stack_name="justindfuller-media"
change_set_name=""
confirmation=""

usage() {
  printf 'Usage: %s --profile PROFILE --change-set NAME --confirm-execution EXECUTE [--stack-name NAME]\n' "$0" >&2
}

while (($#)); do
  case "$1" in
    --profile)
      profile_name="${2:?Missing profile name}"
      shift 2
      ;;
    --stack-name)
      stack_name="${2:?Missing stack name}"
      shift 2
      ;;
    --change-set)
      change_set_name="${2:?Missing change set name}"
      shift 2
      ;;
    --confirm-execution)
      confirmation="${2:?Missing confirmation}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$profile_name" || -z "$change_set_name" || "$confirmation" != "EXECUTE" ]]; then
  usage
  exit 2
fi

aws_cmd() {
  aws --no-cli-pager --profile "$profile_name" --region us-east-1 "$@"
}

account_id="$(aws_cmd sts get-caller-identity --query Account --output text)"
caller_arn="$(aws_cmd sts get-caller-identity --query Arn --output text)"
if [[ "$account_id" != "562465039702" ]]; then
  printf 'Refusing account %s; expected 562465039702.\n' "$account_id" >&2
  exit 1
fi
if [[ "$caller_arn" == *:root ]]; then
  printf 'Refusing root identity. Use a non-root, temporary-credential profile.\n' >&2
  exit 1
fi

change_set_status="$(aws_cmd cloudformation describe-change-set \
  --stack-name "$stack_name" \
  --change-set-name "$change_set_name" \
  --query Status \
  --output text)"
if [[ "$change_set_status" != "CREATE_COMPLETE" ]]; then
  printf 'Refusing change set with status %s; expected CREATE_COMPLETE.\n' "$change_set_status" >&2
  exit 1
fi

aws_cmd cloudformation execute-change-set \
  --stack-name "$stack_name" \
  --change-set-name "$change_set_name"
