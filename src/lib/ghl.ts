import { supabase } from './supabase';
import * as qs from 'qs';
import axios from 'axios';

const GHL_CLIENT_ID = '66c46e35872f50e587c470ac-m7df92pk';
const GHL_SECRET_ID = '7adabf5a-8973-41d6-a464-dfb02883726a';
const GHL_SCOPE = 'contacts.write';
const GHL_REDIRECT_URI = `${window.location.origin}/ghl/callback`;
const GHL_API_URL = 'https://services.leadconnectorhq.com';

interface GHLTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  locationId?: string;
}

export async function initiateGHLAuth() {
  const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&client_id=${GHL_CLIENT_ID}&scope=${GHL_SCOPE}&redirect_uri=${GHL_REDIRECT_URI}`;
  window.location.href = authUrl;
}

export async function disconnectGHL() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'ghl');

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error disconnecting GHL:', error);
    return false;
  }
}

export async function handleGHLCallback(code: string) {
  // console.log('Received code:', code);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Prepare the request body
    const ghlRequestData = qs.stringify({
      client_id: GHL_CLIENT_ID,
      client_secret: GHL_SECRET_ID,
      grant_type: 'authorization_code',
      code: code,
      user_type: 'Location',
      redirect_uri: GHL_REDIRECT_URI,
    });

    // Send request to exchange code for access token
    const response = await axios.post(
      `${GHL_API_URL}/oauth/token`,
      ghlRequestData,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // Ensure the request was successful
    if (response.status !== 200) {
      throw new Error(`Failed to get GHL token. Status: ${response.status}`);
    }

    const data: GHLTokenResponse = response.data;

    // Store tokens in Supabase
    const { error } = await supabase.from('user_integrations').upsert({
      user_id: user.id,
      provider: 'ghl',
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      location_id: data.locationId,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // console.log('GHL token successfully stored.');
    return true;
  } catch (error) {
    console.error('Error handling GHL callback:', error);
    return false;
  }
}

export async function upsertContactToGHL(contactDetails: {
  webinarId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}): Promise<boolean> {
  try {
    // Get webinar owner's GHL integration details
    const { data: webinar, error: webinarError } = await supabase
      .from('webinars')
      .select('user_id')
      .eq('id', contactDetails.webinarId)
      .single();

    if (webinarError || !webinar) {
      throw new Error('Webinar not found');
    }
        // Ensure fresh token before making API calls
        await refreshGHLToken(webinar.user_id);

    // Get GHL integration details for the webinar owner
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('access_token, location_id')
      .eq('provider', 'ghl')
      .eq('user_id', webinar.user_id)
      .maybeSingle();

    if (integrationError || !integration) {
      throw new Error('GHL integration not found');
    }

    const response = await fetch(`${GHL_API_URL}/contacts/upsert`, {
      method: 'POST',
      headers: {
        'Version': '2021-07-28',
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: integration.location_id,
        firstName: contactDetails.firstName,
        lastName: contactDetails.lastName,
        email: contactDetails.email,
        phone: contactDetails.phone,
        source: 'Webinar Registration',
        tags: ['Webinar Attendee'],
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync contact to GHL');
    }

    return true;
  } catch (error) {
    console.error('Error syncing contact to GHL:', error);
    return false;
  }
}

export async function isGHLConnected(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('user_integrations')
      .select('access_token')
      .eq('provider', 'ghl')
      .eq('user_id', user.id)
      .maybeSingle();

    return !!data?.access_token;
  } catch {
    return false;
  }
}

export async function syncContactToGHL(contact: {
  name: string;
  email: string;
  phone: string | null;
}): Promise<boolean> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Split name into first and last name
    const nameParts = contact.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    // Get GHL integration details for the current user
    const { data: integration, error } = await supabase
      .from('user_integrations')
      .select('access_token, location_id')
      .eq('provider', 'ghl')
      .eq('user_id', user.id)
      .maybeSingle();
      // Ensure token is fresh before proceeding
      await refreshGHLToken(user.id);

    if (error || !integration) {
      throw new Error('GHL integration not found');
    }

    const response = await fetch(`${GHL_API_URL}/contacts/upsert`, {
      method: 'POST',
      headers: {
        'Version': '2021-07-28',
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: integration.location_id,
        firstName,
        lastName,
        email: contact.email,
        phone: contact.phone,
        source: 'Webinar Contact',
        tags: ['Webinar Contact'],
      }),
    });

    if (!response.ok) throw new Error('Failed to sync contact to GHL');
    return true;
  } catch (error) {
    console.error('Error syncing contact to GHL:', error);
    return false;
  }

}
/**
 * Refreshes the GHL access token for a specific user
 */
export async function refreshGHLToken(userId: string): Promise<boolean> {
  try {
    // Get the current integration record
    const { data: integration, error: fetchError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('provider', 'ghl')
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !integration) {
      console.error('No GHL integration found for user:', userId);
      return false;
    }
    
    // Check if token needs refreshing (refresh 2 hours before expiry)
    const expiryTime = new Date(integration.expires_at).getTime();
    const twoHoursFromNow = Date.now() + (2 * 60 * 60 * 1000);
    
    // Only refresh if needed
    if (expiryTime > twoHoursFromNow) {
      // console.log('Token still valid for more than 2 hours, no refresh needed');
      return true;
    }
        
    // Prepare refresh token request
    const refreshData = qs.stringify({
      client_id: GHL_CLIENT_ID,
      client_secret: GHL_SECRET_ID,
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
      user_type: 'Location',
      redirect_uri: GHL_REDIRECT_URI,
    });
    
    // Send refresh token request
    const response = await axios.post(
      `${GHL_API_URL}/oauth/token`,
      refreshData,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    if (response.status !== 200) {
      throw new Error(`Failed to refresh GHL token. Status: ${response.status}`);
    }
    
    const tokenData = response.data;
    
    // Update the integration record with new tokens
    const { error: updateError } = await supabase
      .from('user_integrations')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      }as any)
      .eq('id', integration.id);
    
    if (updateError) {
      throw new Error(`Failed to update tokens in database: ${updateError.message}`);
    }
    
    // console.log('GHL token successfully refreshed for user:', userId);
    return true;
  } catch (error) {
    console.error('Error refreshing GHL token:', error);
    return false;
  }
}

/**
 * Sets up a scheduler to refresh tokens before they expire
 */
export function setupTokenRefreshScheduler() {
  // Run the check every hour
  const refreshInterval = 60 * 60 * 1000; // 1 hour in milliseconds
  
  const runTokenRefresh = async () => {
    // console.log('Running scheduled GHL token refresh check...');
    try {
      // Get all GHL integrations that will expire in the next 3 hours
      const threeHoursFromNow = new Date(Date.now() + (3 * 60 * 60 * 1000)).toISOString();
      
      const { data: integrationsToRefresh, error } = await supabase
        .from('user_integrations')
        .select('user_id')
        .eq('provider', 'ghl')
        .lt('expires_at', threeHoursFromNow);
      
      if (error) {
        console.error('Error fetching integrations to refresh:', error);
        return;
      }
      
      // Refresh tokens for each user
      for (const integration of integrationsToRefresh || []) {
        await refreshGHLToken(integration.user_id);
      }
      
      // console.log(`Completed token refresh check. Processed ${integrationsToRefresh?.length || 0} integrations.`);
    } catch (err) {
      console.error('Error in token refresh scheduler:', err);
    }
  };
  
  // Initial run
  runTokenRefresh();
  
  // Set up recurring interval
  const intervalId = setInterval(runTokenRefresh, refreshInterval);
  
  // Return the interval ID so it can be cleared if needed
  return intervalId;
}

/**
 * Helper function to ensure a user's token is fresh before making GHL API calls
 */
export async function withFreshGHLToken<T>(userId: string, apiCallback: () => Promise<T>): Promise<T> {
  // First refresh the token if needed
  await refreshGHLToken(userId);
  
  // Then execute the API call
  return await apiCallback();
}
