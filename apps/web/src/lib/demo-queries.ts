export type DemoQuery = {
  id: string;
  label: string;
  query: string;
};

export const DEFAULT_QUERY =
  "Find ACL 2025 papers that run experiments on the MATH dataset.";

export const DEMO_QUERIES: DemoQuery[] = [
  {
    id: "math_acl2025",
    label: "MATH results",
    query: "Find ACL 2025 papers that run experiments on the MATH dataset.",
  },
  {
    id: "gaia_acl2025",
    label: "GAIA results",
    query: "Find ACL 2025 papers that run experiments on the GAIA dataset.",
  },
  {
    id: "ecomscriptbench_acl2025",
    label: "ECOMSCRIPTBENCH",
    query: "Find ACL 2025 papers that construct, introduce, or benchmark on ECOMSCRIPTBENCH.",
  },
  {
    id: "agent_limitations_acl2025",
    label: "Agent failure cases",
    query: "Find ACL 2025 papers that mention failure cases, limitations, or negative results for agentic or tool-using LLMs.",
  },
  {
    id: "full_paper_claim",
    label: "Full-paper motivation",
    query: "Find ACL-family papers that explicitly state that abstract-only retrieval is insufficient and motivate using full paper content.",
  },
];
