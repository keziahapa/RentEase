const runtimeApiUrl =
  (typeof globalThis !== 'undefined' && (globalThis as any).__RENTEASE_API_URL__) ||
  (typeof process !== 'undefined' && (process as any).env?.RENTEASE_API_URL) ||
  'https://rentease-2-ltfl.onrender.com/api';

export const environment = {
  production: true,
  apiUrl: runtimeApiUrl
};
