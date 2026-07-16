import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTools } from "./tools/list.js";
import { registerReadTools } from "./tools/read.js";
import { registerSearchTools } from "./tools/search.js";
import { registerComposeTools } from "./tools/compose.js";
import { registerOrganizeTools } from "./tools/organize.js";
import { registerEventTools } from "./tools/events.js";
import { registerAITools } from "./tools/ai.js";
import { registerRuleTools } from "./tools/rules.js";

export const server = new McpServer({
  name: "apple-mail",
  version: "0.1.0",
});

registerListTools(server);
registerReadTools(server);
registerSearchTools(server);
registerComposeTools(server);
registerOrganizeTools(server);
registerEventTools(server);
registerAITools(server);
registerRuleTools(server);
