import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * File-based logger for MCP tunnel
 * Logs to ~/.mcp-tunnel/wrapper.log to avoid polluting stdio
 */
class Logger {
  private logDir: string;
  private logFile: string;
  private enabled: boolean;

  constructor() {
    // Only enable logging if MCP_TUNNEL_LOG_LEVEL is set
    this.enabled = !!process.env.JIRA_MCP_DEBUG;

    // Use home directory for log storage
    this.logDir = '.jira-mcp';
    this.logFile = join(this.logDir, 'mcp.log');

    // Ensure log directory exists only if logging is enabled
    if (this.enabled) {
      this.ensureLogDir();
    }
  }

  private ensureLogDir(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: string, prefix: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return JSON.stringify({
          name: arg.name,
          message: arg.message,
          stack: arg.stack,
          cause: arg.cause,
        });
      }
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    }).join(' ');
    return `[${timestamp}] [${level}] ${prefix} ${message}\n`;
  }

  log(prefix: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    try {
      const message = this.formatMessage('INFO', prefix, ...args);
      appendFileSync(this.logFile, message);
    } catch (error) {
      // Silently fail if we can't write to log file
    }
  }

  error(prefix: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    try {
      const message = this.formatMessage('ERROR', prefix, ...args);
      appendFileSync(this.logFile, message);
    } catch (error) {
      // Silently fail if we can't write to log file
    }
  }

  warn(prefix: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    try {
      const message = this.formatMessage('WARN', prefix, ...args);
      appendFileSync(this.logFile, message);
    } catch (error) {
      // Silently fail if we can't write to log file
    }
  }
}

// Export singleton instance
export const logger = new Logger();
