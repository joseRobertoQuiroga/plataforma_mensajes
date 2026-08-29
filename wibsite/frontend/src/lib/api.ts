import { logger } from "./logger";

const HELPER_BASE = process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
const HELPER_API_KEY = process.env.NEXT_PUBLIC_HELPER_API_KEY || "";

export const fetchHelper = async (endpoint: string, options?: RequestInit) => {
  const url = `${HELPER_BASE}${endpoint}`;

  const requestId = `frontend-${Math.random().toString(36).substr(2, 9)}`;

  const headers = new Headers(options?.headers);
  headers.set("X-Request-Id", requestId);
  headers.set("x-api-key", HELPER_API_KEY);
  headers.set("Content-Type", "application/json");

  logger.info(`Fetching ${endpoint}`, { url, requestId, method: options?.method || "GET" });

  try {
    const res = await fetch(url, { ...options, headers, cache: "no-store" });
    if (!res.ok) {
      logger.error(`HTTP Error ${res.status} from ${endpoint}`, { requestId, status: res.status });
      throw new Error(`Error ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    logger.info(`Successfully fetched ${endpoint}`, { requestId });
    return data;
  } catch (error: any) {
    logger.error(`Failed to fetch ${endpoint}`, { error: error.message, requestId });
    throw error;
  }
};
