# Publishing Guide

This guide explains how to publish this GitHub Action for use by Strato Cloud customers.

## Prerequisites

1. A GitHub repository (e.g., `strato-cloud/get-credentials`)
2. GitHub Actions enabled for the repository
3. Node.js 20+ installed locally (for testing)

## Publishing Steps

### 1. Initial Setup

1. **Create the repository** on GitHub (if not already created)
2. **Push the code** to the repository
3. **Create a release tag** to publish the first version:

```bash
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

### 2. Build and Test Locally

Before publishing, test the action locally:

```bash
# Install dependencies
npm install

# Build the action
npm run package

# Verify dist/index.js exists
ls -la dist/index.js
```

### 3. Create a Release

The build workflow will automatically:
- Build the TypeScript code
- Create a release when you push a tag starting with `v*`
- Upload the built artifacts to the release

To create a new release:

```bash
# Update version in package.json if needed
# Create and push a new tag
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

### 4. Verify the Release

1. Go to your repository on GitHub
2. Navigate to **Releases**
3. Verify the release was created with the `dist/` artifacts

## Using the Published Action

Once published, customers can use the action in their workflows:

```yaml
- uses: strato-cloud/get-credentials@v1
  with:
    environment: "123456789012"
    role: "ReadOnly"
    tenant_id: "org_xxx"
```

### Versioning Strategy

- **Major versions** (`v1`, `v2`): Use for breaking changes
- **Minor versions** (`v1.0`, `v1.1`): Use for new features
- **Patch versions** (`v1.0.0`, `v1.0.1`): Use for bug fixes

Customers can pin to:
- `@v2` - Latest v2.x.x (recommended for most users)
- `@v2.0` - Latest v2.0.x
- `@v2.0.0` - Specific version (most stable)

## Development Workflow

1. **Make changes** to `src/index.ts`
2. **Test locally** using `npm run package`
3. **Commit and push** to main branch
4. **Create a release tag** when ready to publish
5. **The build workflow** will automatically build and create a release

## CI/CD Pipeline

The `.github/workflows/build.yml` workflow:
- Runs on pushes to `main` and PRs (builds and tests)
- Runs on tags starting with `v*` (builds and creates release)
- Uses `@vercel/ncc` to bundle all dependencies into `dist/index.js`

## Troubleshooting

### Build fails

- Check that `npm ci` completes successfully
- Verify `tsconfig.json` is correct
- Check for TypeScript errors: `npm run build`

### Release not created

- Verify the tag starts with `v` (e.g., `v1.0.0`)
- Check GitHub Actions workflow logs
- Ensure `GITHUB_TOKEN` has write permissions

### Action not found

- Verify the repository name matches (e.g., `strato-cloud/get-credentials`)
- Check that a release exists with the tag
- Ensure `dist/index.js` is in the release artifacts

## Best Practices

1. **Always test locally** before creating a release
2. **Use semantic versioning** for releases
3. **Update CHANGELOG.md** (if you create one) with each release
4. **Tag releases** with descriptive messages
5. **Keep `dist/` in `.gitignore`** but include it in releases
