import * as core from '@actions/core';

interface TokenExchangeRequest {
  grant_type: string;
  subject_token_type: string;
  subject_token: string;
  requested_token_type: string;
  audience: string;
  scope?: string;
}

interface TokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

/**
 * Request a GitHub Actions OIDC token for the StratoCloud token-exchange audience
 * (strato-api:<tenant>). Shared by both the get-credentials and get-token actions.
 */
export async function getGitHubOIDCToken(tenantId: string): Promise<string> {
  const audience = `strato-api:${tenantId}`;

  try {
    const token = await core.getIDToken(audience);
    return token;
  } catch (error) {
    core.setFailed(`Failed to get GitHub OIDC token: ${error}`);
    throw error;
  }
}

/**
 * Exchange a GitHub OIDC token for a StratoCloud Workload Access Token (SWAT).
 *
 * If `scope` is a non-empty, space-separated list, the SWAT is minted with exactly
 * those scopes (each must be within the integration's allowed_scopes, or the exchange
 * fails). If omitted, the SWAT inherits all of the integration's allowed_scopes.
 */
export async function exchangeTokenForSWAT(
  oidcToken: string,
  tenantId: string,
  authUrl: string,
  scope?: string
): Promise<string> {
  const requestBody: TokenExchangeRequest = {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token_type: 'urn:strato:token-type:github-oidc',
    subject_token: oidcToken,
    requested_token_type: 'urn:strato:token-type:swat',
    audience: `strato-api:${tenantId}`
  };
  if (scope && scope.trim()) {
    requestBody.scope = scope.trim();
  }

  try {
    const response = await fetch(`${authUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as TokenExchangeResponse;

    if (data.error) {
      throw new Error(`Token exchange error: ${data.error} - ${data.error_description || ''}`);
    }

    if (!data.access_token) {
      throw new Error('Token exchange response missing access_token');
    }

    core.setSecret(data.access_token);

    return data.access_token;
  } catch (error) {
    core.setFailed(`Failed to exchange token for SWAT: ${error}`);
    throw error;
  }
}
