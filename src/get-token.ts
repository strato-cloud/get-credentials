import * as core from '@actions/core';
import { getGitHubOIDCToken, exchangeTokenForSWAT } from './exchange';

/**
 * get-token: mint a StratoCloud Workload Access Token (SWAT) from the workflow's
 * GitHub OIDC identity and expose it as an output. Unlike get-credentials (which trades
 * the SWAT for ephemeral cloud credentials and discards it), this action returns the
 * SWAT itself so callers can authenticate directly to StratoCloud APIs.
 *
 * Defaults to production; override `auth_url` only for non-prod (e.g. preview).
 */
async function run(): Promise<void> {
  try {
    const tenantId = core.getInput('tenant_id', { required: true });
    // Default to production. Override only for non-prod environments (e.g. preview).
    const authUrl = core.getInput('auth_url') || 'https://api.app.strato-cloud.io/auth';
    // Optional space-separated scopes. If omitted, the SWAT inherits all of the
    // integration's allowed_scopes; if set, each must be within allowed_scopes.
    const scope = core.getInput('scope');

    core.info('Getting GitHub OIDC token...');
    const oidcToken = await getGitHubOIDCToken(tenantId);

    core.info('Exchanging OIDC token for SWAT...');
    const swat = await exchangeTokenForSWAT(oidcToken, tenantId, authUrl, scope);

    // exchangeTokenForSWAT already registered the value as a secret (masked in logs).
    core.setOutput('swat', swat);

    core.info('✅ SWAT obtained successfully!');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(`Unexpected error: ${error}`);
    }
  }
}

// Run the action
run();
