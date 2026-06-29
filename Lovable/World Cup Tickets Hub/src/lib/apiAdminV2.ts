// =============================================================================
// Story 2.11 / Quartas (F3) — Cliente das chamadas ADMINISTRATIVAS ao gateway YARP
// com Bearer token WORKFORCE (Entra ID + App Role "Admin").
//
// Espelha o padrão de src/lib/apiV2.ts (cliente CIAM), mas pega o token da instância
// MSAL workforce (src/lib/authAdmin.ts). As rotas admin do gateway exigem a policy
// AdminOnly (RequireRole("Admin")):
//   - token workforce com role "Admin" → 200
//   - token CIAM (cliente) válido       → 403 (autenticado, sem a role)
//   - sem token / inválido              → 401
//
// Base URL via VITE_GATEWAY_V2_URL (mesmo gateway do fluxo cliente). Nunca hardcoded.
// =============================================================================

import { getAdminAccessToken } from '@/lib/authAdmin';

const GATEWAY_V2_URL = import.meta.env.VITE_GATEWAY_V2_URL ?? '';

export interface AdminApiResult<T> {
  data?: T;
  error?: string;
  /** HTTP status (útil para distinguir 401 vs 403 no lab didático). */
  status?: number;
}

export interface AdminPingResponse {
  status: string;
  scope: string;
}

/**
 * GET /admin/ping no gateway com Bearer workforce. Demonstra a separação dos dois
 * mundos no próprio gateway (AdminOnly). Sem token workforce → erro local antes da call.
 */
export async function adminPing(): Promise<AdminApiResult<AdminPingResponse>> {
  const token = await getAdminAccessToken();
  if (!token) {
    return { error: 'Faça o login administrativo (Entra workforce) antes de chamar /admin.' };
  }

  try {
    const response = await fetch(`${GATEWAY_V2_URL}/admin/ping`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      let message = `Erro na requisição admin (${response.status})`;
      if (response.status === 401) {
        message = 'Não autorizado (401): token workforce ausente, expirado ou inválido.';
      } else if (response.status === 403) {
        message = 'Proibido (403): autenticado, mas sem a App Role "Admin".';
      }
      return { error: message, status: response.status };
    }

    const data = (await response.json()) as AdminPingResponse;
    return { data, status: response.status };
  } catch (error) {
    console.error('API admin (gateway) error:', error);
    return { error: 'Erro de conexão com o gateway (rota admin).' };
  }
}
