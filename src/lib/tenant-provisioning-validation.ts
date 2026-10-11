/**
 * Tenant Provisioning Account Assembly and Validation
 *
 * Implements canonical cashier-account assembly (prioritizing `counters` array),
 * legacy single-staff fallback, malformed entry detection, and genuine duplicate
 * username validation across proposed accounts for shop / godown creation.
 */

export interface ProposedAccount {
  username: string;
  password?: string;
  role: 'ceo' | 'staff' | 'godown_staff';
  fullName: string;
  source: 'ceo' | 'counter' | 'legacy_staff';
}

export interface CounterInput {
  id?: string;
  username?: string;
  password?: string;
  name?: string;
}

export interface ProvisioningAccountsInput {
  name: string;
  type?: string;
  owner_name?: string;
  email?: string;
  ceo_username?: string;
  ceo_password?: string;
  staff_username?: string;
  staff_password?: string;
  counters?: CounterInput[];
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  proposedAccounts?: ProposedAccount[];
  uniqueUsernames?: string[];
}

/**
 * Validates and canonically assembles proposed accounts from a tenant creation payload.
 *
 * Rules:
 * 1. If `counters` is a non-empty array, it serves as the canonical cashier list.
 *    The legacy `staff_username` scalar is NOT counted a second time.
 * 2. If `counters` is missing or empty, falls back to legacy `staff_username`/`staff_password`.
 * 3. Malformed counter entries (missing/blank username or password) are rejected with an explicit error.
 * 4. Usernames are normalized (trimmed, lowercased) and validated for genuine collisions
 *    (CEO vs counter, or counter vs counter).
 * 5. Password semantics are preserved intact (no trimming or altering).
 */
export function validateAndAssembleAccounts(body: ProvisioningAccountsInput): ValidationResult {
  const {
    name = '',
    type = 'shop',
    owner_name,
    ceo_username,
    ceo_password,
    staff_username,
    staff_password,
    counters,
  } = body;

  const proposedAccounts: ProposedAccount[] = [];

  // 1. CEO Account (if credentials provided)
  if (ceo_username && String(ceo_username).trim()) {
    const cleanCeoUsername = String(ceo_username).trim().toLowerCase();
    proposedAccounts.push({
      username: cleanCeoUsername,
      password: ceo_password !== undefined && ceo_password !== null ? String(ceo_password) : undefined,
      role: 'ceo',
      fullName: owner_name?.trim() || `${name.trim()} Owner`,
      source: 'ceo',
    });
  }

  // 2. Canonical Cashiers (Prioritize counters array, fallback to legacy staff_username)
  const hasCounters = Array.isArray(counters) && counters.length > 0;

  if (hasCounters) {
    for (let i = 0; i < counters.length; i++) {
      const c = counters[i];
      if (!c || typeof c !== 'object') {
        return {
          success: false,
          error: `Counter register #${i + 1} has an invalid configuration structure.`
        };
      }
      const u = c.username ? String(c.username).trim().toLowerCase() : '';
      const p = c.password !== undefined && c.password !== null ? String(c.password) : '';
      if (!u || !p.trim()) {
        return {
          success: false,
          error: `All counter registers must have a valid username and password (counter #${i + 1} is incomplete).`
        };
      }
      proposedAccounts.push({
        username: u,
        password: p,
        role: type === 'godown' ? 'godown_staff' : 'staff',
        fullName: c.name && String(c.name).trim() ? String(c.name).trim() : `${name.trim()} Counter 0${i + 1}`,
        source: 'counter',
      });
    }
  } else if (staff_username && String(staff_username).trim()) {
    // Backward compatibility fallback for legacy callers without counters array
    const cleanStaffUsername = String(staff_username).trim().toLowerCase();
    proposedAccounts.push({
      username: cleanStaffUsername,
      password: staff_password !== undefined && staff_password !== null ? String(staff_password) : undefined,
      role: type === 'godown' ? 'godown_staff' : 'staff',
      fullName: `${name.trim()} Counter 01`,
      source: 'legacy_staff',
    });
  }

  // 3. Check for internal duplicate usernames within request
  const proposedUsernames = proposedAccounts.map(a => a.username);
  const uniqueUsernames = Array.from(new Set(proposedUsernames));
  if (uniqueUsernames.length < proposedUsernames.length) {
    return {
      success: false,
      error: 'Duplicate usernames provided in request. Each user account must have a unique username.'
    };
  }

  return {
    success: true,
    proposedAccounts,
    uniqueUsernames,
  };
}
