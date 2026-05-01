# Testing Guide

This guide explains how to test the action in your private repository before publishing.

## Testing in Private Repository

You can test the action **without publishing it** or making the repository public. The action can reference itself using a local path.

### Quick Start

1. **Push the code** to your private GitHub repository
2. **Set up secrets** in your repository:
   - Go to Settings → Secrets and variables → Actions
   - Add `STRATO_TENANT_ID` (required)
   - Optionally add `STRATO_AUTH_URL` and `STRATO_ACCESS_URL` to override defaults

3. **Run the test workflow**:
   - Go to Actions tab
   - Select "Test Get StratoCloud Credentials"
   - Click "Run workflow"
   - Fill in the inputs and run

### How It Works

The test workflow uses `./action.yml` which references the action in the same repository:

```yaml
- uses: ./action.yml  # Uses local action from this repo
```

This works because:
- ✅ GitHub Actions can use actions from the same repository
- ✅ No publishing or tags required
- ✅ Works in private repositories
- ✅ The action builds itself before running

### Testing Different Scenarios

#### Test AWS Credentials
- Provider: `aws`
- Environment: Your AWS account ID
- Role: `ReadOnly`, `SecurityOperator`, `PowerUser`, or `Administrator`

#### Test Azure Credentials
- Provider: `azure`
- Environment: Your Azure subscription ID
- Role: `ReadOnly`, `SecurityOperator`, `PowerUser`, or `Administrator`

### What Gets Tested

1. **Build**: Verifies TypeScript compiles correctly
2. **Token Exchange**: Tests GitHub OIDC → SWAT token exchange
3. **Credential Request**: Tests credential retrieval from access service
4. **Outputs**: Verifies all outputs are set correctly
5. **Environment Variables**: Verifies credentials are exported (if `set_env: true`)

### Troubleshooting

#### "Action not found" error
- Make sure `action.yml` is in the root of the repository
- Verify the workflow file is in `.github/workflows/`

#### "Failed to exchange token" error
- Check that `STRATO_TENANT_ID` secret is set correctly
- Verify a GitHub integration is configured in StratoCloud for your tenant
- Check that the auth URL is correct (default: `https://api.preview.strato-cloud.io/auth`)

#### "Failed to get credentials" error
- Verify access rules are configured for your workload principal
- Check that the environment ID is correct
- Ensure the role name matches what's configured in StratoCloud
- Verify selector conditions are met (if any)

#### Build fails
- Check that `package.json` and `tsconfig.json` are correct
- Verify all dependencies are listed in `package.json`
- Check the build logs for TypeScript errors

### Testing Before Publishing

You can test everything locally before publishing:

1. **Local testing** (optional):
   ```bash
   npm install
   npm run package
   # Verify dist/index.js exists
   ```

2. **GitHub Actions testing** (recommended):
   - Use the test workflow in your private repo
   - Test with different providers, roles, and environments
   - Verify all outputs and environment variables

3. **Publish when ready**:
   - Once testing is complete, create a release tag
   - The build workflow will automatically publish it
   - Customers can then use: `strato-cloud/get-credentials@v1`

### Example Test Workflow

The `.github/workflows/example.yml` file is set up for testing:

- ✅ Only runs on manual trigger (`workflow_dispatch`)
- ✅ Builds the action before using it
- ✅ Tests both AWS and Azure providers
- ✅ Provides detailed output and summaries
- ✅ Works in private repositories

### Next Steps

After successful testing:
1. Create a release tag: `git tag -a v1.0.0 -m "Initial release"`
2. Push the tag: `git push origin v1.0.0`
3. The build workflow will create a release
4. Customers can then use the published action
