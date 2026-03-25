import * as core from '@actions/core';

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

    core.setSecret(data.access_token);

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
    const response = await fetch(`${authUrl}/permissions/can`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${swatToken}`,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      core.warning(
        `Permissions check failed: ${response.status} ${response.statusText}`
      );
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
    }
  }

  // Omit console_url from serialized output (not exposed as step output or in logs)
  const { console_url: _omitConsole, ...credentialsWithoutConsole } = creds;
  core.setOutput(
    'credentials_json',
    JSON.stringify({ ...credentials, credentials: credentialsWithoutConsole })
  );
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

    core.info('Checking permissions...');
    await checkPermissions(swatToken, environment, role, authUrl);

    core.info(`Requesting credentials for environment: ${environment}, role: ${role}, duration: ${duration}`);
    const credentials = await requestCredentials(swatToken, environment, role, duration, accessUrl);

    core.info('Setting outputs...');
    setOutputs(credentials, setEnv);

    core.info('✅ Credentials obtained successfully!');
    core.info(`Expiration: ${credentials.expiration}`);
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
