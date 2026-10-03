#!/usr/bin/env bash
set -euo pipefail

profile_name=""

usage() {
  printf 'Usage: %s --profile PROFILE\n' "$0" >&2
}

while (($#)); do
  case "$1" in
    --profile)
      profile_name="${2:?Missing profile name}"
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

if [[ -z "$profile_name" ]]; then
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

certificate_count="$(aws_cmd acm list-certificates \
  --certificate-statuses ISSUED PENDING_VALIDATION \
  --query "length(CertificateSummaryList[?DomainName=='media.justindfuller.com'])" \
  --output text)"
if [[ "$certificate_count" -gt 1 ]]; then
  printf 'Multiple active certificates match media.justindfuller.com; resolve them manually.\n' >&2
  exit 1
fi

if [[ "$certificate_count" == "1" ]]; then
  certificate_arn="$(aws_cmd acm list-certificates \
    --certificate-statuses ISSUED PENDING_VALIDATION \
    --query "CertificateSummaryList[?DomainName=='media.justindfuller.com'].CertificateArn | [0]" \
    --output text)"
else
  certificate_arn="$(aws_cmd acm request-certificate \
    --domain-name media.justindfuller.com \
    --validation-method DNS \
    --query CertificateArn \
    --output text)"
fi

status="$(aws_cmd acm describe-certificate \
  --certificate-arn "$certificate_arn" \
  --query Certificate.Status \
  --output text)"
printf 'CertificateArn: %s\nCertificateStatus: %s\n' "$certificate_arn" "$status"

if [[ "$status" == "PENDING_VALIDATION" ]]; then
  aws_cmd acm describe-certificate \
    --certificate-arn "$certificate_arn" \
    --query "Certificate.DomainValidationOptions[?DomainName=='media.justindfuller.com'].ResourceRecord.[Name,Type,Value]" \
    --output text | awk 'NF == 3 { printf "DNS record name: %s\nDNS record type: %s\nDNS record value: %s\n", $1, $2, $3 }'
  printf 'Add the exact CNAME at the current authoritative DNS provider, then rerun this script until the certificate status is ISSUED.\n'
elif [[ "$status" != "ISSUED" ]]; then
  printf 'Certificate is not ready for the stack; inspect ACM status before proceeding.\n' >&2
  exit 1
fi
