import { _accessToken, _tokenType, getTokens, refreshTokens } from '../core/auth/auth-service';
import { env } from '../environment/env';
import type { ApiRequestConfig, ApiResponse } from './unauthenticated-http.utils';
import { apiGetUnauthenticated, apiPostUnauthenticated, httpGetUnauthenticated } from './unauthenticated-http.utils';

// src: https://thetombomb.com/posts/do-you-need-graphql-client
export async function hasuraFetch(query: string) {
  return fetch(env.hasuraGraphQL, {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  // query:
  // `
  //   query samplePokeAPIquery {
  //     gen3_species: pokemon_v2_pokemonspecies(limit: 9, order_by: {id: asc}) {
  //         name
  //         id
  //     }
  // }
  // `
}

export async function httpGet<T>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
  return withAuthRetry(async () => httpGetUnauthenticated(url, await addAuthHeader(config)));
}

export async function apiGet<T>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
  return withAuthRetry(async () => apiGetUnauthenticated(url, await addAuthHeader(config)));
}

export async function apiPost<T>(url: string, body?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
  return withAuthRetry(async () => apiPostUnauthenticated(url, body, await addAuthHeader(config)));
}

async function withAuthRetry<T>(sendRequest: () => Promise<ApiResponse<T>>): Promise<ApiResponse<T>> {
  let resp: ApiResponse<T> | undefined;
  try {
    resp = await sendRequest();
  } catch (err: any) {
    const status = err?.status || err?.statusCode;
    if (status !== 401) {
      throw err;
    }
    await refreshTokens();
    // tslint:disable-next-line:no-console
    console.info('Retrying HTTP request with refreshed token...');
    resp = await sendRequest();
  }
  return resp;
}

async function addAuthHeader(config: ApiRequestConfig | undefined): Promise<ApiRequestConfig> {
  const { headers, _readCachedTokenNoFetch, ...otherConf } = config || ({} as ApiRequestConfig);
  const { accessToken, tokenType } = _readCachedTokenNoFetch
    ? { accessToken: _accessToken, tokenType: _tokenType }
    : await getTokens();
  return {
    ...otherConf,
    headers: {
      ...headers,
      ...(!!accessToken && { Authorization: `${tokenType || 'Bearer'} ${accessToken}` }),
    },
  };
}
