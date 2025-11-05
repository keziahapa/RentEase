const runtimeApiUrl =
  (typeof globalThis !== 'undefined' && (globalThis as any).__RENTEASE_API_URL__) ||
  (typeof process !== 'undefined' && (process as any).env?.RENTEASE_API_URL) ||
  'http://10.20.33.70:8080/api';

export const environment = {
  production: false,
  apiUrl: runtimeApiUrl
};
