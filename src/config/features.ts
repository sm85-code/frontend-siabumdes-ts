/** Build-time opt-in only; never read from localStorage or user permissions. */
export const RISKA_ENABLED = import.meta.env.VITE_RISKA_ENABLED === 'true'
