/** Public website (rider / driver web app) — for links to its legal pages. */
export const WEB_APP_URL = ((import.meta.env.VITE_WEB_APP_URL as string | undefined)?.trim() || "https://getriderite.com").replace(/\/$/, "");
