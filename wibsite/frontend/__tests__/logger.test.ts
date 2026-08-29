import { logger } from "../src/lib/logger";

describe("Logger", () => {
  it("should output JSON logs correctly in non-development environments", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    
    // Simulate non-dev environment
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, "NODE_ENV", { value: "production" });
    
    logger.info("Test message", { key: "value" });
    
    expect(consoleSpy).toHaveBeenCalled();
    const logCallArgs = consoleSpy.mock.calls[0][0];
    const logObj = JSON.parse(logCallArgs);
    
    expect(logObj.level).toBe("info");
    expect(logObj.message).toBe("Test message");
    expect(logObj.context.key).toBe("value");
    
    Object.defineProperty(process.env, "NODE_ENV", { value: originalEnv });
    consoleSpy.mockRestore();
  });
});
