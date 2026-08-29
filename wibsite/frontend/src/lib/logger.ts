type LogLevel = "info" | "warn" | "error" | "debug";

export const logger = {
  log: (level: LogLevel, message: string, context?: any) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: "wibsite-frontend",
      context: context || {},
    };
    
    // In production, you would send this to OTLP collector or just output as JSON 
    // for Docker log driver to pick up and ship to Elasticsearch (SOAC)
    if (process.env.NODE_ENV === "development") {
      console[level === "debug" ? "log" : level](message, context || "");
    } else {
      console.log(JSON.stringify(logEntry));
    }
  },
  info: (msg: string, ctx?: any) => logger.log("info", msg, ctx),
  warn: (msg: string, ctx?: any) => logger.log("warn", msg, ctx),
  error: (msg: string, ctx?: any) => logger.log("error", msg, ctx),
  debug: (msg: string, ctx?: any) => logger.log("debug", msg, ctx),
};