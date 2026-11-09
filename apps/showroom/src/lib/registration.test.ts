/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { merchantPasswordRules, registrationFailureField } from "./registration";

test("canonical signup rejects common and personal passwords before submit", () => {
  const common = merchantPasswordRules({
    password: "Password123",
    email: "merchant@example.com",
    firstName: "Nadia",
    lastName: "Amrani",
  });
  assert.equal(common.uncommon, false);

  const personal = merchantPasswordRules({
    password: "NadiaSecure2026",
    email: "merchant@example.com",
    firstName: "Nadia",
    lastName: "Amrani",
  });
  assert.equal(personal.personal, false);

  const strong = merchantPasswordRules({
    password: "Cedar!Orbit74",
    email: "merchant@example.com",
    firstName: "Nadia",
    lastName: "Amrani",
  });
  assert.deepEqual(strong, {
    length: true,
    letter: true,
    number: true,
    uncommon: true,
    personal: true,
  });
});

test("canonical signup maps API errors to safe field categories", () => {
  assert.equal(registrationFailureField({ email: ["hidden"] }), "email");
  assert.equal(registrationFailureField({ phone_number: ["hidden"] }), "phone");
  assert.equal(registrationFailureField({ non_field_errors: ["hidden"] }), "password");
  assert.equal(registrationFailureField({ confirm_email: ["hidden"] }), "confirmation");
  assert.equal(registrationFailureField(undefined), "general");
});
