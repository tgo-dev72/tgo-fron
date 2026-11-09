/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEPLOY_POLL_MAX_ATTEMPTS,
  DEPLOY_POLL_INTERVAL_MS,
  DEPLOY_POLL_TIMEOUT_MS,
  DEPLOY_STREAM_STALE_TIMEOUT_MS,
  deploymentProgress,
  deploymentProgressPath,
  deploymentStartingPath,
  deploymentPipelineIndex,
  deploymentRequestId,
  isDeploymentLive,
  isDeploymentTerminal,
} from "./deploymentState";

test("a scaffolded or queued deployment remains in progress", () => {
  assert.equal(isDeploymentTerminal({ status: "scaffolding", deploy_status: "deploying" }), false);
  assert.equal(isDeploymentTerminal({ status: "created", deploy_status: "deploying" }), false);
});

test("only provider-ready deployments are presented as live", () => {
  assert.equal(isDeploymentLive({ status: "created", deploy_status: "deployed", pipeline_state: "live" }), true);
  assert.equal(isDeploymentLive({ status: "created", deploy_status: "deployed", pipeline_state: "verifying" }), false);
  assert.equal(isDeploymentLive({ status: "created", deploy_status: "deploying", pipeline_state: "building" }), false);
  assert.equal(isDeploymentLive(null), false);
});

test("durable backend states map to the customer progress timeline", () => {
  assert.equal(deploymentPipelineIndex("preparing"), -1);
  assert.equal(deploymentPipelineIndex("publishing"), 1);
  assert.equal(deploymentPipelineIndex("configuring_domain"), 2);
  assert.equal(deploymentPipelineIndex("building"), 3);
  assert.equal(deploymentPipelineIndex("verifying"), 4);
});

test("provider success and failure are terminal states", () => {
  assert.equal(isDeploymentTerminal({ status: "created", deploy_status: "deployed" }), true);
  assert.equal(isDeploymentTerminal({ status: "created", deploy_status: "deployed", pipeline_state: "verifying" }), false);
  assert.equal(isDeploymentTerminal({ status: "created", deploy_status: "deployed", pipeline_state: "live" }), true);
  assert.equal(isDeploymentTerminal({ status: "failed", deploy_status: "failed" }), true);
});

test("deployment progress links survive refresh and reject invalid identifiers", () => {
  assert.equal(deploymentRequestId("25", "19"), 25);
  assert.equal(deploymentRequestId("invalid", "19"), 19);
  assert.equal(deploymentRequestId("0", "-3", null), null);
  assert.equal(deploymentProgressPath(25), "/launch/25");
  assert.equal(deploymentStartingPath("ma-boutique"), "/launch/pending/ma-boutique");
  assert.equal(deploymentProgress(42.6), 43);
  assert.equal(deploymentProgress(120), 100);
  assert.equal(deploymentProgress(Number.NaN), 0);
});

test("polling allows slow provider builds for at least fifteen minutes", () => {
  assert.equal(DEPLOY_POLL_TIMEOUT_MS, 15 * 60 * 1_000);
  assert.ok(DEPLOY_POLL_MAX_ATTEMPTS >= 450);
});

test("a silent live stream falls back to polling within a bounded period", () => {
  assert.ok(DEPLOY_STREAM_STALE_TIMEOUT_MS >= DEPLOY_POLL_INTERVAL_MS * 3);
  assert.ok(DEPLOY_STREAM_STALE_TIMEOUT_MS <= 10_000);
});
