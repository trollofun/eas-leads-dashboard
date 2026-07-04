const DATA_MANAGER_BASE = 'https://datamanager.googleapis.com/v1';

interface CustomerMatchMember {
  hashedPhoneNumber?: string;
  hashedEmailAddress?: string;
  ipData?: { ipAddress: string; observeStartTime?: string; observeEndTime?: string }[];
}

interface SyncResult {
  uploaded: number;
  errors: string[];
}

export async function syncCustomerMatch(members: CustomerMatchMember[]): Promise<SyncResult> {
  if (!members.length) return { uploaded: 0, errors: [] };
  const settingsRaw = await getSettings('customer_match');
  if (!settingsRaw?.enabled || !settingsRaw?.listId) {
    return { uploaded: 0, errors: ['Customer Match not configured'] };
  }
  return syncAudienceList(members, settingsRaw.listId, settingsRaw.validateOnly === true);
}

// Generic: push hashed members to any Google Ads user list (Customer Match sau exclusion)
export async function syncAudienceList(members: CustomerMatchMember[], listId: string, validateOnly = false): Promise<SyncResult> {
  if (!members.length) return { uploaded: 0, errors: [] };

  const operatingAccountId = process.env.GOOGLE_ADS_OPERATING_ACCOUNT_ID;
  const loginAccountId = process.env.GOOGLE_ADS_LOGIN_ACCOUNT_ID || operatingAccountId;

  const BATCH_SIZE = 100;
  let uploaded = 0;
  const errors: string[] = [];

  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const batch = members.slice(i, i + BATCH_SIZE);

    // Docs: POST /v1/audienceMembers:ingest — body uses audienceMembers > compositeData > userData
    const requestBody = {
      destinations: [{
        operatingAccount: { accountType: 'GOOGLE_ADS', accountId: operatingAccountId },
        loginAccount: { accountType: 'GOOGLE_ADS', accountId: loginAccountId },
        productDestinationId: listId,
      }],
      audienceMembers: batch.map(m => {
        const userIdentifiers: any[] = [];
        if (m.hashedPhoneNumber) userIdentifiers.push({ phoneNumber: m.hashedPhoneNumber });
        if (m.hashedEmailAddress) userIdentifiers.push({ emailAddress: m.hashedEmailAddress });
        const compositeData: any = { userData: { userIdentifiers } };
        // v1.7: raw IPs (never hashed) improve match rate for Google Ads Customer Match
        if (m.ipData?.length) compositeData.ipData = m.ipData;
        return { compositeData };
      }),
      consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_GRANTED' },
      encoding: 'HEX',
      termsOfService: { customerMatchTermsOfServiceStatus: 'ACCEPTED' },
      validateOnly,
    };

    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datamanager'] });
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      const res = await fetch(`${DATA_MANAGER_BASE}/audienceMembers:ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken.token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        uploaded += batch.length;
      } else {
        const errText = await res.text();
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${res.status} ${errText.slice(0, 200)}`);
      }
    } catch (e: any) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${e.message}`);
    }
  }

  return { uploaded, errors };
}

async function getSettings(key: string): Promise<any> {
  const { prisma } = await import('./db');
  const row = await prisma.dashboard_settings.findUnique({ where: { key } });
  return row?.value as any;
}
