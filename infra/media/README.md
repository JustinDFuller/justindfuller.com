# Public blog image delivery

This stack stores image objects in a private S3 bucket and serves them through CloudFront at `https://media.justindfuller.com/`. CloudFront uses an Origin Access Control (OAC), and the bucket grants `GetObject` only for the content-addressed `v1/` prefix to this distribution. Markdown stays in its existing private source; the published image bytes are intentionally public to anyone with the URL.

## Preconditions

- Confirm account `562465039702` is eligible for CloudFront flat-rate plans. AWS says an account using AWS Free Tier cannot subscribe. Use an IAM Identity Center or other non-root temporary-credential profile with only the required setup permissions; every script refuses an account-root principal.
- Install AWS CLI v2. Request the certificate and deploy the CloudFormation stack in `us-east-1`. The certificate must be issued there for CloudFront.
- Have control of the existing DNS provider for `justindfuller.com`. No nameserver migration or Route 53 hosted zone is needed.
- Decide which email should receive budget alerts. The budget watches S3 and CloudFront service charges in the account and is a notification, not a hard spending cap.

## Deployment sequence

1. Request or reuse the DNS-validated certificate:

   ```sh
   ./infra/media/request-certificate.sh --profile MEDIA_DEPLOYER
   ```

   On first run, the script requests an ACM certificate and prints its ARN and the exact validation CNAME. Add that CNAME to the current DNS provider. Rerun until status is `ISSUED`. The script only searches ACM in `us-east-1`, and errors if multiple active certificates exactly match the hostname.

2. Prepare a CloudFormation change set (this creates a change set but does not provision resources):

   ```sh
   ./infra/media/prepare-stack.sh \
     --profile MEDIA_DEPLOYER \
     --certificate-arn CERTIFICATE_ARN \
     --alert-email YOUR_ALERT_EMAIL
   ```

3. Review the `justindfuller-media` change set in CloudFormation. It includes the private, versioned bucket; OAC; CloudFront distribution; WAF ACL; `$0` CloudFront `FREE` plan subscription; narrowly scoped image upload managed policy; and a `$1/month` S3/CloudFront cost budget.

4. After reviewing the exact change set name and resource changes, execute it explicitly:

   ```sh
   ./infra/media/execute-stack.sh \
     --profile MEDIA_DEPLOYER \
     --change-set CHANGE_SET_NAME \
     --confirm-execution EXECUTE
   ```

5. Wait for stack creation and the CloudFront distribution to deploy. Add the distribution-domain CNAME from the `MediaDistributionDomainName` stack output to `media.justindfuller.com` at the existing DNS provider. The certificate validation CNAME is separate and must remain present for renewal.

6. Create a dedicated non-root IAM user for the current Obsidian plugin and attach the `MediaUploadPolicyArn` policy. It permits `PutObject`, `GetObject`, and aborting an incomplete multipart upload only for `v1/*`, plus `ListBucket`. The publisher uses `HeadObject` before and after upload; S3 returns 403 instead of 404 for a missing key unless the caller also has `s3:ListBucket`. S3 does not document a key-prefix condition for that `HeadObject` existence check, so this dedicated bucket must remain limited to published media; the plugin can enumerate object names in it but can read bytes only under `v1/*`. The policy does not allow delete, ACL changes, or bucket administration. The plugin accepts an access key pair and stores it in macOS Keychain; enter the dedicated key through the plugin settings, never put it in vault settings, source files, or shell history, and rotate or revoke it when no longer needed. Use a separate short-lived IAM Identity Center profile for infrastructure CLI work. Do not use root credentials.

7. Build and install `tools/obsidian-image-publisher/` into the Obsidian vault. Configure its destination from the `MediaBucketName` stack output, enter the dedicated uploader key in the plugin's Keychain-backed settings, and run **Publish images now**. The plugin uploads each supported `Blog/image/` file under `v1/<sha256>.<extension>`, verifies it, and writes `Blog/asset-manifest.json`. Verify that the selected private Markdown sync backend carries that manifest to the website source before deploying the website change. The app serves only CloudFront URLs; it never fetches image bytes into server memory.

## Cost and limits

- The plan subscription is explicitly `FREE`: $0/month, with published baseline allowances of 1 million viewer requests, 100 GB transfer, and 5 GB S3 Standard storage credit per month. CloudFront does not charge overages under this plan. Allowances are not hard traffic caps: substantial sustained usage can receive lower-priority/fewer-edge delivery. S3 API request charges (including uncached origin GETs and uploads) remain ordinary S3 charges; the 5 GB credit only offsets S3 Standard storage. The included per-IP WAF rate rule blocks a single IP after 10,000 requests in a 5-minute evaluation window, but distributed traffic is not a hard spend limit.
- The `$1/month` AWS Budget alerts at 80% actual and 100% forecast for S3 and CloudFront service costs. It aggregates those services across this AWS account and cannot stop usage. AWS Budgets monitoring and notifications are free; this template creates no budget actions or reports.
- S3 versioning retains overwritten objects as noncurrent versions for up to 30 days; incomplete multipart uploads are aborted after 7 days. Those controls limit retained-version and incomplete-upload accumulation but don't cap total object count or current-image storage.
- The CloudFront plan includes the distribution, WAF ACL/rules, TLS certificate, and standard log ingestion; the template does not enable access-log delivery. Adding other separately billed CloudFront/WAF/logging features changes the cost model. The plan-managed hosted-zone credit is not used because DNS remains external.
- The CloudFormation bucket has `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain`. Deleting or replacing the stack leaves bucket data behind; review ownership and remove it deliberately if ever retired.

## DNS and public-access handoff

The user must add the ACM validation CNAME first. After the stack deploys, add `media.justindfuller.com CNAME <MediaDistributionDomainName>` at the current provider. Do not proxy or point the name at S3. The S3 bucket keeps all Block Public Access settings enabled, and its policy allows only the associated CloudFront distribution to read `v1/*`. Anyone can fetch an image through the public CloudFront hostname once they know its URL; unguessable URLs are not access control.

The WAF rate rule and fixed CloudFront plan limit the billing exposure of viewer delivery, but they do not provide a universal dollar-denominated hard cap for S3 API calls or storage. Limit the publisher to `Blog/image/`, restrict IAM object permissions to the `v1/` prefix, and inspect the account budget alerts and S3 usage. CloudFront also adds `Content-Security-Policy: sandbox; default-src 'none'` to prevent public SVGs from running scripts or loading active external content when opened directly.

## References

- [CloudFront flat-rate pricing plans](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html)
- [CloudFormation pricing-plan subscription](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-pricingplanmanager-subscription.html)
- [CloudFront OAC with a private S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [CloudFront response headers policies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/creating-response-headers-policies.html)
- [S3 `HeadObject` missing-object permission behavior](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html)
- [ACM and CloudFront custom-domain requirements](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-procedures.html)
- [AWS CLI IAM Identity Center profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)
- [S3 lifecycle rules](https://docs.aws.amazon.com/AmazonS3/latest/userguide/intro-lifecycle-rules.html)
- [AWS Budgets pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/)
