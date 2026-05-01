# Get Strato Cloud Credentials GitHub Action

[![Build](https://github.com/strato-cloud/get-credentials/actions/workflows/build.yml/badge.svg)](https://github.com/strato-cloud/get-credentials/actions/workflows/build.yml)

This GitHub Action enables you to obtain ephemeral workload JIT (Just-In-Time) credentials from Strato Cloud using GitHub Actions OIDC tokens.

## Quick Start

```yaml
- uses: strato-cloud/get-credentials@v1
  with:
    environment: "123456789012"
    role: "ReadOnly"
    tenant_id: "org_xxx"
```

## Features

- 🔐 **Secure**: Uses GitHub OIDC tokens for authentication (no long-lived secrets)
- 🔄 **Automatic Token Exchange**: Exchanges GitHub OIDC tokens for Strato Workload Access Tokens (SWAT)
- ☁️ **Multi-Cloud Support**: Works with AWS, Azure, and GCP environments
- ⚡ **JIT Credentials**: Provides ephemeral credentials with configurable duration
- 🔒 **Secure Outputs**: Automatically masks sensitive values in logs

## Prerequisites

1. **Strato Cloud Integration**: A GitHub integration must be configured in your Strato Cloud tenant
2. **Access Rules**: Appropriate access rules must be configured for your workload principal
3. **Permissions**: The GitHub Actions workflow must have permission to request OIDC tokens

### Required GitHub Actions Permissions

Add the following to your workflow file:

```yaml
permissions:
  id-token: write  # Required for OIDC token
  contents: read   # Usually required for repository access
```

## Installation

Add this action to your workflow by referencing the published action:

```yaml
- uses: strato-cloud/get-credentials@v1
```

Or use a specific version:

```yaml
- uses: strato-cloud/get-credentials@v1
```

## Usage

### Basic Example (AWS)

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

permissions:
  id-token: write  # Required for OIDC token
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Get Strato Cloud Credentials
        id: credentials
        uses: strato-cloud/get-credentials@v1
        with:
          environment: "123456789012"  # AWS Account ID
          role: "ReadOnly"
          duration: "1h"
          reason: "deploy main to production"
          tenant_id: "org_xxx"
          auth_url: "https://auth.strato.cloud"
          access_url: "https://api.strato.cloud"
      
      - name: Use AWS Credentials
        run: |
          aws s3 ls
          # Credentials are automatically set as environment variables
          # AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
```

### Azure Example

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Get Strato Cloud Credentials
        id: credentials
        uses: strato-cloud/get-credentials@v1
        with:
          environment: "subscription-123"  # Azure Subscription ID
          role: "Administrator"
          duration: "2h"
          tenant_id: "org_xxx"
      
      - name: Login to Azure
        run: |
          # Use the guest user email and TAP for authentication
          az login --username "${{ steps.credentials.outputs.guest_user_email }}" \
                   --password "${{ steps.credentials.outputs.tap }}" \
                   --tenant "${{ steps.credentials.outputs.tenant_id_output }}"
```

### Using Outputs Instead of Environment Variables

```yaml
- name: Get Strato Cloud Credentials
  id: credentials
  uses: strato-cloud/get-credentials@v1
  with:
    environment: "123456789012"
    role: "ReadOnly"
    duration: "1h"
    tenant_id: "org_xxx"
    set_env: "false"  # Don't set environment variables

- name: Use Credentials from Outputs
  run: |
    export AWS_ACCESS_KEY_ID="${{ steps.credentials.outputs.access_key_id }}"
    export AWS_SECRET_ACCESS_KEY="${{ steps.credentials.outputs.secret_access_key }}"
    export AWS_SESSION_TOKEN="${{ steps.credentials.outputs.session_token }}"
    aws s3 ls
```

### Custom Service URLs

```yaml
- name: Get Strato Cloud Credentials
  uses: strato-cloud/get-credentials@v1
  with:
    environment: "123456789012"
    role: "ReadOnly"
    duration: "1h"
    tenant_id: "org_xxx"
    auth_url: "https://auth.preview.strato.cloud"  # Custom auth URL
    access_url: "https://api.preview.strato.cloud"  # Custom access URL
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `environment` | Cloud environment identifier (AWS account ID, Azure subscription ID, etc.) | Yes | - |
| `role` | The name of the Role associated with the credentials (e.g., ReadOnly, Administrator) | Yes | - |
| `duration` | The duration the credentials should be valid for (e.g., 1h, 30m) | Yes | `1h` |
| `reason` | Optional reason for requesting credentials (included in StratoCloud audit context) | No | - |
| `tenant_id` | Strato Cloud tenant ID (used in audience for token exchange) | Yes | - |
| `auth_url` | Strato Cloud auth service URL | No | `https://auth.strato.cloud` |
| `access_url` | Strato Cloud access service URL | No | `https://api.strato.cloud` |
| `set_env` | Set credentials as environment variables (true/false) | No | `true` |

## Outputs

### AWS Credentials

| Output | Description |
|--------|-------------|
| `access_key_id` | AWS Access Key ID |
| `secret_access_key` | AWS Secret Access Key |
| `session_token` | AWS Session Token |
| `console_url` | AWS Console URL (if available) |
| `expiration` | Credential expiration timestamp |
| `credentials_json` | Full credentials as JSON string |

**Environment Variables (when `set_env: true`):**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `AWS_CONSOLE_URL` (if available)

### Azure Credentials

| Output | Description |
|--------|-------------|
| `guest_user_email` | Azure guest user email |
| `tap` | Azure Time-based Access Password |
| `tenant_id_output` | Azure tenant ID |
| `subscription_id` | Azure subscription ID |
| `console_url` | Azure Portal URL (if available) |
| `expiration` | Credential expiration timestamp |
| `credentials_json` | Full credentials as JSON string |

**Environment Variables (when `set_env: true`):**
- `AZURE_GUEST_USER_EMAIL`
- `AZURE_TAP`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_CONSOLE_URL` (if available)

## How It Works

1. **Get GitHub OIDC Token**: The action requests an OIDC token from GitHub with the audience `strato-api:<tenant_id>`
2. **Exchange for SWAT Token**: The GitHub OIDC token is exchanged for a Strato Workload Access Token (SWAT) via the auth service
3. **Request Credentials**: The SWAT token is used to request ephemeral credentials from the access service
4. **Output Credentials**: Credentials are provided as outputs and optionally as environment variables

## Security Considerations

- ✅ All sensitive values are automatically masked in GitHub Actions logs
- ✅ Credentials are ephemeral and expire after the specified duration
- ✅ No long-lived secrets are required
- ✅ Access is controlled by Strato Cloud access rules and conditions

## Access Rules

To use this action, you need to configure access rules in Strato Cloud. Example:

```bash
curl -X POST https://auth.strato.cloud/auth/acl \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "resource_id": "123456789012",
      "resource_type": "environment",
      "principal": "workload:github:int_xxx",
      "actions": ["access::ReadOnly"],
      "conditions": {
        "selectors": "ci.provider:github AND ci.repo:my-org/my-repo"
      }
    }
  ]'
```

The principal format is `workload:github:<integration_id>`, where `integration_id` is the ID of your GitHub integration in Strato Cloud.

## Troubleshooting

### Error: Failed to exchange token

- Verify that a GitHub integration is configured in your Strato Cloud tenant
- Check that the `tenant_id` is correct
- Ensure the GitHub Actions workflow has `id-token: write` permission

### Error: Failed to get credentials

- Verify that access rules are configured for your workload principal
- Check that the environment ID is correct
- Ensure the role name matches what's configured in Strato Cloud
- Verify that any selector conditions are met (e.g., branch, workflow name)

### Credentials not set as environment variables

- Check that `set_env: true` (default) is set
- Verify the credentials were successfully obtained (check the action output)

## License

This action is provided as-is. Please refer to your Strato Cloud agreement for terms of use.
