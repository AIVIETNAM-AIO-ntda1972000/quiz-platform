import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readJson(path: string) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

describe("Quiz Platform plugin package", () => {
  it("defines matching portable and compatibility identities", () => {
    const portable = readJson("./plugin.json");
    const compatibility = readJson("./.codex-plugin/plugin.json");
    expect(portable.name).toBe("quiz-platform");
    expect(compatibility.name).toBe(portable.name);
    expect(compatibility.version).toBe(portable.version);
    expect(portable.extensions["com.openai"].interface.privacyPolicyURL).toMatch(/^https:\/\//);
  });

  it("uses Streamable HTTP for the remote MCP endpoint", () => {
    const portableMcp = readJson("./mcp.json");
    const server = portableMcp.mcpServers["quiz-platform"];
    expect(server.type).toBe("streamable-http");
    expect(server.url).toMatch(/^https:\/\/.+\.supabase\.co\/functions\/v1\/quiz-mcp$/);
  });

  it("covers every required evaluation category", () => {
    const evaluations = readJson("./evals/prompts.json");
    const categories = evaluations.cases.map((item: { category: string }) => item.category);
    expect(categories).toEqual(expect.arrayContaining([
      "direct",
      "indirect",
      "follow-up",
      "replacement",
      "invalid-schema",
      "negative-tool-selection",
    ]));
  });
});
