import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTools } from "./tools/list.js";
import { registerReadTools } from "./tools/read.js";
import { registerSearchTools } from "./tools/search.js";
import { registerComposeTools } from "./tools/compose.js";
import { registerOrganizeTools } from "./tools/organize.js";
import { registerEventTools } from "./tools/events.js";
import { registerAITools } from "./tools/ai.js";
import { registerRuleTools } from "./tools/rules.js";

// Single source of truth for the version clients see: package.json
// (dist/server.js → ../package.json, which npm always ships).
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

export const server = new McpServer({
  name: "apple-mail",
  version,
});

registerListTools(server);
registerReadTools(server);
registerSearchTools(server);
registerComposeTools(server);
registerOrganizeTools(server);
registerEventTools(server);
registerAITools(server);
registerRuleTools(server);
