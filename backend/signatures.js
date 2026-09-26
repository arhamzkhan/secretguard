module.exports = [
  {
    name: "AWS Access Key",
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: "high",
    what: "A string matching the AWS Access Key ID format was found in this file.",
    why: "If this is a real, active key, anyone with repo access (or who finds this in a public repo) can use it to access your AWS account.",
    fix: "Rotate this key immediately in the AWS console, then remove it from the file and use environment variables or a secrets manager instead. Consider using git-filter-repo to scrub it from history."
  },
  {
    name: "AWS Secret Key",
    regex: /aws_secret_access_key\s*[:=]\s*['"][0-9a-zA-Z/+]{40}['"]/gi,
    severity: "high",
    what: "A string matching the AWS Secret Access Key format was found in this file.",
    why: "AWS Secret Access Keys grant API access to your AWS infrastructure alongside an Access Key ID.",
    fix: "Rotate the associated AWS key pair immediately in IAM, remove the secret from source code, and use environment variables or AWS Secrets Manager."
  },
  {
    name: "Generic API Key",
    regex: /(api[_-]?key)\s*[:=]\s*['"][0-9a-zA-Z]{16,}['"]/gi,
    severity: "medium",
    what: "An assignment matching a generic API key pattern was detected.",
    why: "Exposing API keys in public code repositories can allow unauthorized third parties to consume your service quotas or access restricted data.",
    fix: "Revoke or rotate the key in your API provider dashboard. Store keys in .env files (excluded from git) or use environment variable injection."
  },
  {
    name: "GitHub Token",
    regex: /gh[pousr]_[0-9a-zA-Z]{36}/g,
    severity: "high",
    what: "A Personal Access Token or OAuth token matching GitHub's format was detected.",
    why: "GitHub tokens grant repository, user, or organization-level access depending on scopes, enabling unauthorized account access or code tampering.",
    fix: "Revoke the token immediately in GitHub Settings -> Developer Settings -> Personal Access Tokens. Scrub the commit history if necessary."
  },
  {
    name: "Slack Token",
    regex: /xox[baprs]-[0-9a-zA-Z-]{10,}/g,
    severity: "high",
    what: "A token matching Slack bot, user, or app authorization formats was found.",
    why: "Exposed Slack tokens can allow unauthorized access to workspace messages, files, channels, and webhook integrations.",
    fix: "Revoke the token in your Slack App Administration dashboard and regenerate new bot/user credentials."
  },
  {
    name: "Private Key Block",
    regex: /-----BEGIN (RSA|EC )?PRIVATE KEY-----/g,
    severity: "high",
    what: "A PEM-encoded RSA or EC private key header was found in this file.",
    why: "Private keys are used to authenticate SSH, TLS, or cryptographic operations. Leaking them compromises encryption and server access.",
    fix: "Generate a new keypair immediately, revoke the old public key from authorized servers/providers, and remove the private key file from git."
  },
  {
    name: "Generic Password Assignment",
    regex: /password\s*[:=]\s*['"][^'"]{6,}['"]/gi,
    severity: "medium",
    what: "A hardcoded password assignment was detected in source code.",
    why: "Hardcoding credentials in source files risks exposing passwords in public repositories or to unauthorized team members.",
    fix: "Change the password immediately. Pass credentials at runtime via environment variables or a configuration secret store."
  },
  {
    name: "Stripe Key",
    regex: /sk_live_[0-9a-zA-Z]{24,}/g,
    severity: "high",
    what: "A live secret key matching Stripe's API key format was detected.",
    why: "Stripe live secret keys allow full control over payment processing, refunds, customer records, and payouts on your Stripe account.",
    fix: "Roll the live key immediately in the Stripe Dashboard under Developers -> API keys, and remove the key from code."
  },
  {
    name: "Google API Key",
    regex: /AIza[0-9A-Za-z-_]{35}/g,
    severity: "medium",
    what: "A credential matching Google Cloud / Firebase API key signature was found.",
    why: "Exposed Google API keys can lead to unauthorized API usage, billing overages, or access to Cloud services if quota/domain restrictions are missing.",
    fix: "Restrict key usage by HTTP referrers / IP addresses in Google Cloud Console, or regenerate the key and store it securely."
  }
];
