#!/usr/bin/env bash
set -euo pipefail

profile_name=""
certificate_arn=""
alert_email=""
stack_name="justindfuller-media"

usage() {
  printf 'Usage: %s --profile PROFILE --certificate-arn ARN --alert-email EMAIL [--stack-name NAME]\n' "$0" >&2
}

while (($#)); do
  case "$1" in
    --profile)
      profile_name="${2:?Missing profile name}"
      shift 2
      ;;
    --certificate-arn)
      certificate_arn="${2:?Missing certificate ARN}"
      shift 2
      ;;
    --alert-email)
      alert_email="${2:?Missing alert email}"
      shift 2
      ;;
    --stack-name)
      stack_name="${2:?Missing stack name}"
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

if [[ -z "$profile_name" || -z "$certificate_arn" || -z "$alert_email" ]]; then
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

certificate_status="$(aws_cmd acm describe-certificate \
  --certificate-arn "$certificate_arn" \
  --query Certificate.Status \
  --output text)"
if [[ "$certificate_status" != "ISSUED" ]]; then
  printf 'Certificate status is %s; it must be ISSUED before preparing the stack.\n' "$certificate_status" >&2
  exit 1
fi

template_path="$(cd "$(dirname "$0")" && pwd)/template.yaml"
aws_cmd cloudformation deploy \
  --stack-name "$stack_name" \
  --template-file "$template_path" \
  --parameter-overrides "CertificateArn=$certificate_arn" "BudgetAlertEmail=$alert_email" \
  --capabilities CAPABILITY_IAM \
  --no-execute-changeset

printf '\nThe change set is prepared but has not been executed. Review it in the CloudFormation console or run:\n'
printf 'aws --profile %q --region us-east-1 cloudformation list-change-sets --stack-name %q --query "Summaries[].{Name:ChangeSetName,Status:Status,Type:ChangeSetType,Created:CreationTime}" --output table\n' "$profile_name" "$stack_name"
