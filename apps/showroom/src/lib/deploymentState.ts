export const DEPLOY_POLL_INTERVAL_MS = 2_000;
export const DEPLOY_STREAM_STALE_TIMEOUT_MS = 8_000;
export const DEPLOY_POLL_TIMEOUT_MS = 15 * 60 * 1_000;
export const DEPLOY_POLL_MAX_ATTEMPTS = Math.ceil(
  DEPLOY_POLL_TIMEOUT_MS / DEPLOY_POLL_INTERVAL_MS,
);

export type DeploymentState = {
  status: "pending" | "scaffolding" | "created" | "failed";
  deploy_status: "not_deployed" | "deploying" | "deployed" | "failed";
  pipeline_state?: "accepted" | "preparing" | "publishing" | "provisioning" | "configuring_domain" | "building" | "verifying" | "live" | "failed";
};

export function isDeploymentTerminal(deployment: DeploymentState): boolean {
  if (deployment.status === "failed" || deployment.deploy_status === "failed") return true;
  if (deployment.deploy_status !== "deployed") return false;
  // Older records did not expose pipeline_state. Current releases are complete
  // only after public health verification reaches the explicit live state.
  return deployment.pipeline_state ? deployment.pipeline_state === "live" : true;
}

export function isDeploymentLive(deployment: DeploymentState | null): boolean {
  return deployment?.deploy_status === "deployed" && deployment.pipeline_state === "live";
}

export function deploymentPipelineIndex(state: DeploymentState["pipeline_state"]): number {
  switch (state) {
    case "accepted":
    case "preparing":
      return -1;
    case "publishing":
      return 1;
    case "provisioning":
    case "configuring_domain":
      return 2;
    case "building":
      return 3;
    case "verifying":
      return 4;
    case "live":
      return 5;
    default:
      return -1;
  }
}

export function deploymentRequestId(...candidates: Array<string | null | undefined>): number | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const value = Number(candidate);
    if (Number.isSafeInteger(value) && value > 0) return value;
  }
  return null;
}

export function deploymentProgressPath(requestId: number): string {
  return `/launch/${encodeURIComponent(requestId)}`;
}

export function deploymentStartingPath(storeSlug: string): string {
  return `/launch/pending/${encodeURIComponent(storeSlug)}`;
}

export function deploymentProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
