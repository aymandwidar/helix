import { ToolDefinition } from "./index";

const MAX_BYTES = 100_000;

export const webFetchTool: ToolDefinition = {
    name: "web_fetch",
    description: "Fetch the contents of a URL (HTTP/HTTPS only). Returns the response body as text, truncated if large.",
    parameters: {
        url: { type: "string", description: "Absolute URL to fetch (http:// or https://)." },
        method: { type: "string", description: "HTTP method.", enum: ["GET", "HEAD"], default: "GET" },
    },
    required: ["url"],
    async execute(args) {
        const url = String(args.url || "");
        const method = (String(args.method || "GET").toUpperCase() as "GET" | "HEAD");

        if (!/^https?:\/\//i.test(url)) {
            return { success: false, output: "", error: "Only http:// and https:// URLs are allowed." };
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30_000);
            const response = await fetch(url, { method, signal: controller.signal });
            clearTimeout(timeout);

            const headers: Record<string, string> = {};
            response.headers.forEach((v, k) => { headers[k] = v; });

            if (method === "HEAD") {
                return { success: response.ok, output: `status=${response.status}\n${JSON.stringify(headers, null, 2)}` };
            }

            const text = await response.text();
            const truncated = text.length > MAX_BYTES
                ? text.slice(0, MAX_BYTES) + `\n…(+${text.length - MAX_BYTES} chars)`
                : text;
            return {
                success: response.ok,
                output: `status=${response.status}\ncontent-type=${headers["content-type"] || "?"}\n\n${truncated}`,
                error: response.ok ? undefined : `HTTP ${response.status}`,
            };
        } catch (err: any) {
            return { success: false, output: "", error: err?.message || String(err) };
        }
    },
};
