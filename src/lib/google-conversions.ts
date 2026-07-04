const DATA_MANAGER_API_BASE = 'https://datamanager.googleapis.com/v1';
const MAX_QUEUE_SIZE = 25;
const MAX_ATTEMPTS = 5;

interface ConversionInput {
  conversionActionId: string;
  transactionId: string;
  eventTimestamp: Date;
  value: number;
  currency: string;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  emailHash?: string | null;
  phoneHash?: string | null;
  validateOnly?: boolean;
}

export async function uploadGoogleAdsOfflineConversion(input: ConversionInput): Promise<{
  requestId: string;
}> {
  const operatingAccountId = process.env.GOOGLE_ADS_OPERATING_ACCOUNT_ID;
  const loginAccountId = process.env.GOOGLE_ADS_LOGIN_ACCOUNT_ID || operatingAccountId;

  const event: any = {
    transactionId: input.transactionId,
    eventTimestamp: input.eventTimestamp.toISOString(),
    currency: input.currency,
    conversionValue: input.value,
    conversionCount: 1,
    eventSource: 'WEB',
    consent: {
      adUserData: process.env.GOOGLE_CONSENT_AD_USER_DATA === 'GRANTED' ? 'CONSENT_GRANTED' : 'CONSENT_DENIED',
      adPersonalization: process.env.GOOGLE_CONSENT_AD_PERSONALIZATION === 'GRANTED' ? 'CONSENT_GRANTED' : 'CONSENT_DENIED',
    },
  };

  // Add click IDs if present
  if (input.gclid || input.gbraid || input.wbraid) {
    event.adIdentifiers = {};
    if (input.gclid) event.adIdentifiers.gclid = input.gclid;
    if (input.gbraid) event.adIdentifiers.gbraid = input.gbraid;
    if (input.wbraid) event.adIdentifiers.wbraid = input.wbraid;
  }

  // Add user data for matching
  const userIdentifiers: any[] = [];
  if (input.emailHash) {
    userIdentifiers.push({ emailAddress: input.emailHash });
  }
  if (input.phoneHash) {
    userIdentifiers.push({ phoneNumber: input.phoneHash });
  }
  if (userIdentifiers.length > 0) {
    event.userData = { userIdentifiers };
  }

  const requestBody = {
    destinations: [
      {
        operatingAccount: {
          accountType: 'GOOGLE_ADS',
          accountId: operatingAccountId,
        },
        loginAccount: {
          accountType: 'GOOGLE_ADS',
          accountId: loginAccountId,
        },
        productDestinationId: input.conversionActionId,
      },
    ],
    events: [event],
    encoding: 'HEX',
    validateOnly: input.validateOnly ?? process.env.GOOGLE_DATAMANAGER_VALIDATE_ONLY === 'true',
  };

  // Make API call directly using fetch + Application Default Credentials
  const { GoogleAuth } = await import('google-auth-library');

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/datamanager'],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const response = await fetch(`${DATA_MANAGER_API_BASE}/accounts/-:ingestEvents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken.token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Data Manager API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  return {
    requestId: result.requestId || 'unknown',
  };
}
