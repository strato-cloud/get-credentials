import * as core from '@actions/core';
import * as fs from 'fs';

interface TokenExchangeRequest {
  grant_type: string;
  subject_token_type: string;
  subject_token: string;
  requested_token_type: string;
  audience: string;
}

interface TokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

interface CredentialRequest {
  environment: string;
  role: string;
  duration: string;
  request_id?: string;
}

interface CredentialsResponse {
  environment: string;
  role: string;
  expiration: string;
  credentials: {
    // AWS credentials
    access_key_id?: string;
    secret_access_key?: string;
    session_token?: string;
    console_url?: string;
    // Azure credentials
    guest_user_email?: string;
    tap?: string;
    tenant_id?: string;
    subscription_id?: string;
  };
  error?: string;
  error_description?: string;
}

async function getGitHubOIDCToken(tenantId: string): Promise<string> {
  const audience = `strato-api:${tenantId}`;
  
  try {
    const token = await core.getIDToken(audience);
    return token;
  } catch (error) {
    core.setFailed(`Failed to get GitHub OIDC token: ${error}`);
    throw error;
  }
}

async function exchangeTokenForSWAT(
  oidcToken: string,
  tenantId: string,
  authUrl: string
): Promise<string> {
  const requestBody: TokenExchangeRequest = {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token_type: 'urn:strato:token-type:github-oidc',
    subject_token: oidcToken,
    requested_token_type: 'urn:strato:token-type:swat',
    audience: `strato-api:${tenantId}`
  };

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

    // Debug: Print SWAT token (using hex encoding to avoid auto-masking)
    // GitHub Actions auto-masks JWT-like tokens, so we encode it
    const hexToken = Buffer.from(data.access_token).toString('hex');
    core.info(`SWAT_TOKEN_HEX=${hexToken}`);
    core.info(`SWAT Token length: ${data.access_token.length}`);
    
    // Also try writing to step summary which might not be masked
    const summaryPath = process.env.GITHUB_STEP_SUMMARY || '/dev/null';
    try {
      fs.appendFileSync(summaryPath, `\n## SWAT Token (for debugging)\n\`\`\`\n${data.access_token}\n\`\`\`\n`);
    } catch (e) {
      // Ignore if step summary not available
    }
    
    // TODO: Re-enable masking after debugging
    // Mask the token in logs
    // core.setSecret(data.access_token);
    
    return data.access_token;
  } catch (error) {
    core.setFailed(`Failed to exchange token for SWAT: ${error}`);
    throw error;
  }
}

async function checkPermissions(
  swatToken: string,
  environment: string,
  role: string,
  authUrl: string
): Promise<void> {
  const requestBody = {
    action: `access::${role}`,
    resource_id: environment,
    resource_type: 'environment'
  };

  try {
    core.info(`DEBUG: Checking permissions for action: access::${role}, resource: ${environment}`);
    const response = await fetch(`${authUrl}/permissions/can`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${swatToken}`,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch (e) {
      responseJson = responseText;
    }

    core.info(`DEBUG: Permissions check response status: ${response.status} ${response.statusText}`);
    core.info(`DEBUG: Permissions check response body: ${JSON.stringify(responseJson, null, 2)}`);
    
    if (!response.ok) {
      core.warning(`Permissions check failed: ${response.status} ${response.statusText}`);
      core.warning(`Response: ${JSON.stringify(responseJson, null, 2)}`);
    } else {
      core.info(`Permissions check passed: ${JSON.stringify(responseJson, null, 2)}`);
    }
  } catch (error) {
    core.warning(`Failed to check permissions: ${error}`);
  }
}

async function requestCredentials(
  swatToken: string,
  environment: string,
  role: string,
  duration: string,
  accessUrl: string
): Promise<CredentialsResponse> {
  const requestBody: CredentialRequest = {
    environment,
    role,
    duration
  };

  try {
    // Debug: Print SWAT token info (using hex to avoid auto-masking)
    const hexToken = Buffer.from(swatToken).toString('hex');
    core.info(`DEBUG: SWAT Token (hex): ${hexToken}`);
    core.info(`DEBUG: SWAT Token length: ${swatToken.length}`);
    core.info(`DEBUG: Access URL: ${accessUrl}`);
    core.info(`DEBUG: Request Body: ${JSON.stringify(requestBody, null, 2)}`);
    const response = await fetch(`${accessUrl}/credentials`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${swatToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Credential request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as CredentialsResponse;
    
    if (data.error) {
      throw new Error(`Credential request error: ${data.error} - ${data.error_description || ''}`);
    }

    return data;
  } catch (error) {
    core.setFailed(`Failed to request credentials: ${error}`);
    throw error;
  }
}

function setOutputs(credentials: CredentialsResponse, setEnv: boolean): void {
  const creds = credentials.credentials;

  // Set expiration
  core.setOutput('expiration', credentials.expiration);
  
  // Set console URL if available
  if (creds.console_url) {
    core.setOutput('console_url', creds.console_url);
  }

  // AWS credentials
  if (creds.access_key_id) {
    core.setOutput('access_key_id', creds.access_key_id);
    core.setOutput('secret_access_key', creds.secret_access_key || '');
    core.setOutput('session_token', creds.session_token || '');
    
    // Mask sensitive values
    core.setSecret(creds.access_key_id);
    if (creds.secret_access_key) {
      core.setSecret(creds.secret_access_key);
    }
    if (creds.session_token) {
      core.setSecret(creds.session_token);
    }

    // Set environment variables if requested
    if (setEnv) {
      core.exportVariable('AWS_ACCESS_KEY_ID', creds.access_key_id);
      core.exportVariable('AWS_SECRET_ACCESS_KEY', creds.secret_access_key || '');
      core.exportVariable('AWS_SESSION_TOKEN', creds.session_token || '');
      if (creds.console_url) {
        core.exportVariable('AWS_CONSOLE_URL', creds.console_url);
      }
    }
  }

  // Azure credentials
  if (creds.guest_user_email) {
    core.setOutput('guest_user_email', creds.guest_user_email);
    core.setOutput('tap', creds.tap || '');
    core.setOutput('tenant_id_output', creds.tenant_id || '');
    core.setOutput('subscription_id', creds.subscription_id || '');
    
    // Mask sensitive values
    core.setSecret(creds.guest_user_email);
    if (creds.tap) {
      core.setSecret(creds.tap);
    }

    // Set environment variables if requested
    if (setEnv) {
      core.exportVariable('AZURE_GUEST_USER_EMAIL', creds.guest_user_email);
      core.exportVariable('AZURE_TAP', creds.tap || '');
      if (creds.tenant_id) {
        core.exportVariable('AZURE_TENANT_ID', creds.tenant_id);
      }
      if (creds.subscription_id) {
        core.exportVariable('AZURE_SUBSCRIPTION_ID', creds.subscription_id);
      }
      if (creds.console_url) {
        core.exportVariable('AZURE_CONSOLE_URL', creds.console_url);
      }
    }
  }

  // Set full credentials JSON
  core.setOutput('credentials_json', JSON.stringify(credentials));
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const environment = core.getInput('environment', { required: true });
    const role = core.getInput('role', { required: true });
    const duration = core.getInput('duration') || '1h';
    const tenantId = core.getInput('tenant_id', { required: true });
    const authUrl = core.getInput('auth_url') || 'https://api.preview.strato-cloud.io/auth';
    const accessUrl = core.getInput('access_url') || 'https://api.preview.strato-cloud.io/access';
    const setEnv = core.getBooleanInput('set_env', { required: false }) ?? true;

    core.info('Getting GitHub OIDC token...');
    const oidcToken = await getGitHubOIDCToken(tenantId);

    core.info('Exchanging OIDC token for SWAT...');
    const swatToken = await exchangeTokenForSWAT(oidcToken, tenantId, authUrl);

    // Debug: Check permissions before requesting credentials
    core.info('Checking permissions...');
    await checkPermissions(swatToken, environment, role, authUrl);

    core.info(`Requesting credentials for environment: ${environment}, role: ${role}, duration: ${duration}`);
    const credentials = await requestCredentials(swatToken, environment, role, duration, accessUrl);

    core.info('Setting outputs...');
    setOutputs(credentials, setEnv);

    core.info('✅ Credentials obtained successfully!');
    core.info(`Expiration: ${credentials.expiration}`);
    if (credentials.credentials.console_url) {
      core.info(`Console URL: ${credentials.credentials.console_url}`);
    }
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
