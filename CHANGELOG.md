# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2024-01-XX

### Added
- Initial release of Get Strato Cloud Credentials action
- Support for AWS credentials (Access Key ID, Secret Access Key, Session Token)
- Support for Azure credentials (Guest User Email, TAP, Tenant ID, Subscription ID)
- Automatic token exchange from GitHub OIDC to Strato Workload Access Token (SWAT)
- Environment variable export for credentials
- Output variables for all credential types
- Automatic masking of sensitive values in logs
- Configurable credential duration
- Support for custom auth and access service URLs

[Unreleased]: https://github.com/strato-cloud/get-credentials/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/strato-cloud/get-credentials/releases/tag/v1.0.0
