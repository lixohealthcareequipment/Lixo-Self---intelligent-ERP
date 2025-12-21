// SHA-256 hash helper
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input.trim().toLowerCase()));
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

// DEBUG ENDPOINT - Temporary route for testing Supabase INSERT directly
async function handleDebugInsertIdentity(request: Request, env: any): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), { status: 405, headers: { "Content-Type": "application/json" }});
  }
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return new Response(JSON.stringify({ ok: false, error: "content_type_must_be_json", content_type: ct }), { status: 400, headers: { "Content-Type": "application/json" }});
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.zoho_lead_id) {
    return new Response(JSON.stringify({ ok: false, error: "zoho_lead_id_required" }), { status: 400, headers: { "Content-Type": "application/json" }});
  }

  const zoho_lead_id = String(body.zoho_lead_id);
  const email = body.email ? String(body.email) : "";
  const phone = body.phone ? String(body.phone) : "";

  const email_hash = email ? await sha256Hex(email) : null;
  const phone_hash = phone ? await sha256Hex(phone) : null;

  const url = `${env.SUPABASE_URL}/rest/v1/identity_map`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Prefer": "return=representation",
      "Content-Profile": "prod",
      "Accept-Profile": "prod"
    },
    body: JSON.stringify([{ zoho_lead_id, email_hash, phone_hash }])
  });

  const text = await res.text();
  return new Response(JSON.stringify({
    ok: res.ok,
    status: res.status,
    supabase_body_head: text.slice(0, 300),
    test_id: zoho_lead_id
  }), { status: res.ok ? 200 : 500, headers: { "Content-Type": "application/json" }});
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;
    
  // DEBUG ENDPOINT ROUTING - Check for debug endpoint first
  if (pathname === "/v1/debug/insert_identity || pathname === "/v1/debug/insert_identity/"") {
    return await handleDebugInsertIdentity(request, env);
  }

    // POST /v1/zoho/lead_created

    // Supabase INSERT helper function with proper auth headers
async function supabaseInsertIdentity(env, body) {
  const base = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const url = `${base}245/identity_map`;

  const srk = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !srk) {
    return { ok: false, status: 500, text: "BLOCKED: Supabase secrets missing" };
  }

  // Hard validate required keys (must match table columns exactly)
  const payload = {
    zoho_lead_id: String(body.zoho_lead_id || ""),
    email_hash: String(body.email_hash || ""),
    phone_hash: String(body.phone_hash || ""),
    // Optional UTM fields if present:
    utm_source: body.utm_source ? String(body.utm_source) : null,
    utm_medium: body.utm_medium ? String(body.utm_medium) : null,
    utm_campaign: body.utm_campaign ? String(body.utm_campaign) : null,
    first_utm_source: body.first_utm_source ? String(body.first_utm_source) : null
  };

  if (!payload.zoho_lead_id || (!payload.email_hash && !payload.phone_hash)) {
    return { ok: false, status: 400, text: "invalid_payload: missing zoho_lead_id or hashes" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": srk,
      "Authorization": `Bearer ${srk}`,
      "Prefer": "return=representation",
      "Content-Profile": "prod",
      "Accept-Profile": "prod"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text(); // IMPORTANT: capture body for debugging
  return { ok: res.ok, status: res.status, text };
}

    if (method === 'POST' && pathname === '/v1/zoho/lead_created') {
      try {
        // Check Supabase secrets
        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
          return new Response(JSON.stringify({ ok: false, error: 'BLOCKED: Supabase secrets missing in worker' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

// Parse payload based on Content-Type
const ct = request.headers.get('content-type') || '';
let payload = {};
try {
  if (ct.includes('application/json')) {
    payload = await request.json();
  } else if (ct.includes('application/x-www-form-urlencoded')) {
    const txt = await request.text();
    payload = Object.fromEntries(new URLSearchParams(txt));
  } else if (ct.includes('multipart/form-data')) {
    const fd = await request.formData();
    payload = Object.fromEntries(fd.entries());
  } else {
    const txt = await request.text();
    try {
      payload = JSON.parse(txt);
    } catch {
      payload = Object.fromEntries(new URLSearchParams(txt));
    }
  }
} catch (parseErr) {
  return new Response(JSON.stringify({ ok: false, error: 'parse_failed', message: parseErr.message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}
console.log({ path: '/v1/zoho/lead_created', method: 'POST', ct, keys: Object.keys(payload) });
const body = payload
        const { zoho_lead_id, email, phone } = body;

        console.info('Lead webhook', { zoho_lead_id, email, phone: phone ? 'MASKED' : null });

        // 1. Resolve identity
        const identity = await resolveIdentity(env, { email, phone });
        console.info('Identity resolved', { id: identity.id });

        // 2. Link Zoho lead ID to identity
        if (zoho_lead_id) {
          await linkZohoLead(env, identity.id, zoho_lead_id);
          console.info('Lead linked', { identity_id: identity.id, zoho_lead_id });
        }

        // 3. Writeback to Zoho
        if (env.ZOHO_WRITEBACK === 'true' && zoho_lead_id) {
          await writeBackToZhoLead(env, zoho_lead_id, {
            Identity_ID: identity.id,
            UTM_Source: identity.utm_source || '',
            UTM_Medium: identity.utm_medium || '',
            UTM_Campaign: identity.utm_campaign || '',
            First_Touch_UTM_Source: identity.first_touch_source || ''
          });
          console.info('Write back to Zoho', { zoho_lead_id });
        }

        return new Response(JSON.stringify({ ok: true, identity_id: identity.id, zoho_updated: env.ZOHO_WRITEBACK === 'true' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Handler error', { error: error.message });
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Fallback
    return new Response(JSON.stringify({ ok: false, error: "not_found", pathname }), {      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * 1. Normalize + hash email/phone, resolve or create identity
 */
async function resolveIdentity(env, { email, phone }) {
  const normalized_email = email ? email.toLowerCase().trim() : null;
  const normalized_phone = phone ? phone.replace(/\D/g, '') : null;

  // Create hash identifiers
  const email_hash = normalized_email ? 'email_' + await hashSHA256(normalized_email) : null;
  const phone_hash = normalized_phone ? 'phone_' + await hashSHA256(normalized_phone) : null;

  const identity_id = email_hash || phone_hash || 'anon_' + Date.now();

  console.info('Identity resolution', { email_hash: email_hash ? 'MASKED' : null, phone_hash: phone_hash ? 'MASKED' : null, identity_id });

  // Supabase SELECT to find existing
  let existingRow = null;
  if (email_hash || phone_hash) {
    const searchFilters = [];
    if (email_hash) searchFilters.push(`email_hash=eq.${email_hash}`);
    if (phone_hash) searchFilters.push(`phone_hash=eq.${phone_hash}`);
    const orFilter = searchFilters.join(',');

    try {
      const selectResponse = await fetch(
        `${env.SUPABASE_URL}/rest/v1/identity_map?${orFilter}&limit=1`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      );
      if (selectResponse.ok) {
        const rows = await selectResponse.json();
        if (rows && rows.length > 0) {
          existingRow = rows[0];
        }
      }
    } catch (e) {
      console.error('Supabase SELECT error', { error: e.message });
    }
  }

  // INSERT if none, else UPDATE
  let upsertedId = identity_id;
  let utm_source = null, utm_medium = null, utm_campaign = null, first_touch_source = null;

  if (existingRow) {
    // UPDATE existing
    upsertedId = existingRow.id;
    utm_source = existingRow.utm_source;
    utm_medium = existingRow.utm_medium;
    utm_campaign = existingRow.utm_campaign;
    first_touch_source = existingRow.first_touch_source;

    const updatePayload = {};
    if (email_hash) updatePayload.email_hash = email_hash;
    if (phone_hash) updatePayload.phone_hash = phone_hash;
    if (email) updatePayload.email = email;
    if (phone) updatePayload.phone = phone;
    updatePayload.updated_at = new Date().toISOString();

    try {
      const updateResponse = await fetch(
        `${env.SUPABASE_URL}/rest/v1/identity_map?id=eq.${existingRow.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updatePayload)
        }
      );
      if (!updateResponse.ok) {
        console.error('Supabase UPDATE failed', { status: updateResponse.status });
      }
    } catch (e) {
      console.error('Supabase PATCH error', { error: e.message });
    }
  } else {
    // INSERT new
    const insertPayload = {
      id: upsertedId,
      email: email || null,
      phone: phone || null,
      email_hash: email_hash || null,
      phone_hash: phone_hash || null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      first_touch_source: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const sb = await supabaseInsertIdentity(env, {zoho_lead_id, email_hash, phone_hash, utm_source, utm_medium, utm_campaign, first_utm_source});
      console.log({supabase_status: sb.status, supabase_ok: sb.ok});
      if (!sb.ok) {
        return new Response(JSON.stringify({ok:false,error:'supabase_insert_failed',supabase_status:sb.status}), {status: 500, headers: {'Content-Type': 'application/json'}});
      }
      }
      catch  (e) {
      console.error('Supabase POST error', { error: e.message });
    }
  }

  return {
    id: upsertedId,
    email,
    phone,
    email_hash,
    phone_hash,
    utm_source,
    utm_medium,
    utm_campaign,
    first_touch_source
  };
}

/**
 * 2. Link Zoho lead ID to identity
 */
async function linkZohoLead(env, identity_id, zoho_lead_id) {
  // TODO: Update identity_map with zoho_lead_id if needed
  // For now, this is logged in the main handler
}

/**
 * 3. Write back Identity_ID and UTM fields to Zoho Lead
 */
async function writeBackToZhoLead(env, zoho_lead_id, fields) {
  console.info('Write back to Zoho', { zoho_lead_id });

  // Step 1: Get OAuth access token
  let accessToken = null;
  try {
    const tokenResponse = await fetch(
      `${env.ZOHO_ACCOUNTS_URL}/oauth/v2/token?refresh_token=${env.ZOHO_REFRESH_TOKEN}&client_id=${env.ZOHO_CLIENT_ID}&client_secret=${env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`,
      { method: 'POST' }
    );
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
    } else {
      console.error('Zoho OAuth token error', { status: tokenResponse.status });
      return { success: false, error: 'Failed to get access token' };
    }
  } catch (e) {
    console.error('Zoho OAuth error', { error: e.message });
    return { success: false, error: e.message };
  }

  if (!accessToken) {
    return { success: false, error: 'No access token' };
  }

  // Step 2: Update Zoho Lead with fields
  const updatePayload = {
    data: [{
      id: zoho_lead_id,
      Identity_ID: fields.Identity_ID || null,
      UTM_Source: fields.UTM_Source || null,
      UTM_Medium: fields.UTM_Medium || null,
      UTM_Campaign: fields.UTM_Campaign || null,
      First_Touch_UTM_Source: fields.First_Touch_UTM_Source || null
    }]
  };

  try {
    const updateResponse = await fetch(
      `${env.ZOHO_BASE_URL}/crm/v2/Leads/${zoho_lead_id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(updatePayload)
      }
    );
    if (updateResponse.ok) {
      const result = await updateResponse.json();
      console.info('Zoho update success', { zoho_lead_id });
      return { success: true };
    } else {
      const errorText = await updateResponse.text();
      console.error('Zoho update error', { status: updateResponse.status, error: errorText });
      return { success: false, error: `Zoho API error: ${updateResponse.status}` };
    }
  } catch (e) {
    console.error('Zoho update exception', { error: e.message });
    return { success: false, error: e.message };
  }
}

/**
 * SHA-256 hash using Web Crypto API
 */
async function hashSHA256(value) {
  if (!value) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
