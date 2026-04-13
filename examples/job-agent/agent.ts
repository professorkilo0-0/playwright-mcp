/**
 * Job Search & Application Agent
 * Uses Claude API + Playwright MCP to find and apply for jobs
 *
 * Usage:
 *   npx tsx agent.ts              # Search and apply
 *   npx tsx agent.ts --search-only # Search only, no auto-apply
 */

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { PROFILE } from "./profile.ts";
import { generateCoverLetter } from "./cover-letter.ts";
import fs from "fs";

const SEARCH_ONLY = process.argv.includes("--search-only");

// ---------- Logging ----------
const LOG_FILE = "applied-jobs.json";

interface JobLog {
  date: string;
  title: string;
  company: string;
  url: string;
  salary?: string;
  status: "applied" | "skipped" | "failed";
  notes?: string;
}

function loadLog(): JobLog[] {
  if (fs.existsSync(LOG_FILE)) {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  }
  return [];
}

function saveLog(entries: JobLog[]) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2));
}

// ---------- System Prompt ----------
function buildSystemPrompt(): string {
  const cv = `
NAME: ${PROFILE.personal.name}
EMAIL: ${PROFILE.personal.email}
PHONE: ${PROFILE.personal.phone}
ADDRESS: ${PROFILE.personal.address}

PERSONAL STATEMENT:
${PROFILE.personalStatement}

SKILLS: ${PROFILE.skills.join(", ")}

WORK EXPERIENCE:
${PROFILE.workExperience.map(w =>
  `- ${w.title} at ${w.company} (${w.dates})\n  ${w.highlights.slice(0, 3).join("; ")}`
).join("\n")}

EDUCATION:
${PROFILE.education.map(e =>
  `- ${e.institution} (${e.dates}): ${e.qualifications.join(", ")}`
).join("\n")}
`.trim();

  const coverLetter = generateCoverLetter("[JOB TITLE]", "[COMPANY]");

  return `You are a job application agent acting on behalf of ${PROFILE.personal.name}.

Your goal:
1. Search job boards for roles matching the criteria below
2. Navigate to each listing and assess if it's a good fit
3. ${SEARCH_ONLY ? "List the jobs found — DO NOT apply (search-only mode)" : "Apply to suitable roles by filling out application forms"}
4. Log each job with its URL, title, company, salary and outcome

CANDIDATE PROFILE:
${cv}

JOB SEARCH CRITERIA:
- Target roles: ${PROFILE.jobSearch.targetRoles.join(", ")}
- Salary range: £${PROFILE.jobSearch.targetSalaryMin.toLocaleString()} – £${PROFILE.jobSearch.targetSalaryMax.toLocaleString()}
- Locations: ${PROFILE.jobSearch.locations.join(", ")} (within ~15 miles of High Wycombe)
- Work type: ${PROFILE.jobSearch.remote}

JOB BOARDS TO SEARCH:
- https://www.reed.co.uk/jobs/hr-administrator-jobs-in-buckinghamshire
- https://www.totaljobs.com/jobs/in-high-wycombe
- https://uk.indeed.com/jobs?q=HR+administrator+£35000&l=High+Wycombe
- https://www.cv-library.co.uk/jobs-in-buckinghamshire
- https://jobs.buckinghamshire.gov.uk/

COVER LETTER TEMPLATE (customise [JOB TITLE] and [COMPANY] for each application):
${coverLetter}

INSTRUCTIONS:
- Use browser_navigate to visit job boards
- Use browser_snapshot to read page content
- Use browser_fill_form or browser_type to fill in application fields
- When a form asks for a cover letter, generate one tailored to that specific role
- Skip roles outside the salary range or too far from High Wycombe
- After each job (applied or skipped), output a summary line:
  RESULT: <status> | <title> | <company> | <salary> | <url>
- Do NOT enter payment details or sign up for paid services
- If a site requires account creation, use ${PROFILE.personal.email} and note it in the log`;
}

// ---------- MCP + Claude Setup ----------
async function runAgent() {
  console.log("Starting Playwright MCP server...");
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["@playwright/mcp@latest", "--headless"],
  });

  const mcpClient = new Client({ name: "job-agent", version: "1.0.0" });
  await mcpClient.connect(transport);
  console.log("Playwright MCP connected.");

  // Get Playwright tools
  const { tools: mcpTools } = await mcpClient.listTools();
  const playwrightTools: Anthropic.Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: (t.inputSchema ?? { type: "object", properties: {} }) as Anthropic.Tool["input_schema"],
  }));

  console.log(`Loaded ${playwrightTools.length} Playwright tools.`);

  // Add web search
  const allTools = [
    ...playwrightTools,
    {
      name: "log_job",
      description: "Log a job application result to the applied-jobs.json file",
      input_schema: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Job title" },
          company: { type: "string", description: "Company name" },
          url: { type: "string", description: "Job listing URL" },
          salary: { type: "string", description: "Salary as shown in listing" },
          status: { type: "string", enum: ["applied", "skipped", "failed"], description: "Outcome" },
          notes: { type: "string", description: "Any relevant notes" },
        },
        required: ["title", "company", "url", "status"],
      },
    },
  ];

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Search for ${PROFILE.jobSearch.targetRoles.slice(0, 4).join(", ")} jobs paying £${PROFILE.jobSearch.targetSalaryMin.toLocaleString()}–£${PROFILE.jobSearch.targetSalaryMax.toLocaleString()} in ${PROFILE.jobSearch.locations[0]} and surrounding Buckinghamshire area.

Visit the job boards in the system prompt, find at least 5 suitable listings, and ${SEARCH_ONLY ? "list them with salary and apply link" : "apply to each one using the candidate profile"}.`,
    },
  ];

  const log = loadLog();

  console.log(`\n${SEARCH_ONLY ? "SEARCH ONLY MODE" : "SEARCH + APPLY MODE"}\n`);
  console.log("Agent running — this may take a few minutes...\n");

  // Agentic loop
  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: buildSystemPrompt(),
      tools: allTools as Anthropic.Tool[],
      messages,
    });

    // Append assistant response
    messages.push({ role: "assistant", content: response.content });

    // Print text output
    for (const block of response.content) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }

    if (response.stop_reason === "end_turn") {
      console.log("\nAgent finished.");
      break;
    }

    if (response.stop_reason !== "tool_use") break;

    // Handle tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      let result: string;

      if (block.name === "log_job") {
        // Handle our custom log tool
        const input = block.input as JobLog;
        const entry: JobLog = {
          date: new Date().toISOString(),
          title: input.title,
          company: input.company,
          url: input.url,
          salary: input.salary,
          status: input.status,
          notes: input.notes,
        };
        log.push(entry);
        saveLog(log);
        result = `Logged: ${entry.status} — ${entry.title} at ${entry.company}`;
        console.log(`\n[LOG] ${result}`);
      } else {
        // Call Playwright MCP tool
        try {
          const mcpResult = await mcpClient.callTool({
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
          result = JSON.stringify(mcpResult.content);
        } catch (err) {
          result = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  // Summary
  const session = log.filter((j) => {
    const d = new Date(j.date);
    const now = new Date();
    return now.getTime() - d.getTime() < 60 * 60 * 1000; // last hour
  });

  console.log("\n========== SESSION SUMMARY ==========");
  console.log(`Applied: ${session.filter((j) => j.status === "applied").length}`);
  console.log(`Skipped: ${session.filter((j) => j.status === "skipped").length}`);
  console.log(`Failed:  ${session.filter((j) => j.status === "failed").length}`);
  console.log(`Log saved to: ${LOG_FILE}`);

  await mcpClient.close();
}

runAgent().catch((err) => {
  console.error("Agent error:", err);
  process.exit(1);
});
