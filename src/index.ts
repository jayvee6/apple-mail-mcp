#!/usr/bin/env node
/**
 * apple-mail-mcp — MCP server for Apple Mail
 *
 * Transport: stdio (Claude Desktop / claude-code MCP config)
 * Requires: Apple Mail with Automation permission granted to the node process
 * Optional: MailKit extension posting to localhost:27182/event for real-time events
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";
import { startBridge } from "./bridge.js";

async function main(): Promise<void> {
  // Start the HTTP bridge for MailKit extension events (idles harmlessly if extension not installed)
  const bridgeServer = startBridge();

  const shutdown = () => bridgeServer.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Connect to Claude via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[apple-mail] MCP server started.");
}

main().catch((err: Error) => {
  console.error("[apple-mail] Fatal error:", err.message);
  process.exit(1);
});
