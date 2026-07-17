import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listMyLeaves from "./tools/list-my-leaves";
import listMyAttendance from "./tools/list-my-attendance";
import listMyOvertime from "./tools/list-my-overtime";

// Build the OAuth issuer from the project ref so it stays on the direct
// supabase.co host (never the .lovable.cloud proxy). VITE_ vars are inlined by
// Vite at build time, so no runtime env read happens at import time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ensepro-hr-mcp",
  title: "EnsePro HR",
  version: "0.1.0",
  instructions:
    "Tools that expose the signed-in employee's own HR data from EnsePro: profile, leave requests, attendance, and overtime. All access is scoped by the user's account permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listMyLeaves, listMyAttendance, listMyOvertime],
});
