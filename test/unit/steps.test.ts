import type { Page } from "playwright";
import { describe, expect, it, mock } from "bun:test";

import type { TargetGuard } from "../../src/config/allowlist.js";
import {
  ERROR_CODES,
  isRunFailure,
  type RunFailure,
} from "../../src/run/errors.js";
import { executeStep } from "../../src/run/steps.js";
import type { Step } from "../../src/schema/request.js";

interface FakeLocator {
  fill: ReturnType<typeof mock>;
  click: ReturnType<typeof mock>;
  press: ReturnType<typeof mock>;
  selectOption: ReturnType<typeof mock>;
  check: ReturnType<typeof mock>;
  waitFor: ReturnType<typeof mock>;
  innerText: ReturnType<typeof mock>;
  inputValue: ReturnType<typeof mock>;
}

interface FakePage {
  goto: ReturnType<typeof mock>;
  url: ReturnType<typeof mock>;
  getByRole: ReturnType<typeof mock>;
  getByLabel: ReturnType<typeof mock>;
  getByTestId: ReturnType<typeof mock>;
  getByText: ReturnType<typeof mock>;
  locator: ReturnType<typeof mock>;
}

const DEFAULT_URL = "http://localhost:3000/checkout";
const TARGET = { by: "testId", value: "order-id" } as const;

function fakeLocator(overrides: Partial<FakeLocator> = {}): FakeLocator {
  return {
    fill: mock().mockResolvedValue(undefined),
    click: mock().mockResolvedValue(undefined),
    press: mock().mockResolvedValue(undefined),
    selectOption: mock().mockResolvedValue(undefined),
    check: mock().mockResolvedValue(undefined),
    waitFor: mock().mockResolvedValue(undefined),
    innerText: mock().mockResolvedValue("Order received"),
    inputValue: mock().mockResolvedValue("read value"),
    ...overrides,
  };
}

function fakePage(locator: FakeLocator, url: string = DEFAULT_URL): FakePage {
  return {
    goto: mock().mockResolvedValue(undefined),
    url: mock(() => url),
    getByRole: mock(() => locator),
    getByLabel: mock(() => locator),
    getByTestId: mock(() => locator),
    getByText: mock(() => locator),
    locator: mock(() => locator),
  };
}

function fakeGuard(): TargetGuard {
  return {
    assertAllowed: mock().mockResolvedValue(new URL(DEFAULT_URL)),
    isRequestAllowed: mock(() => true),
  } as unknown as TargetGuard;
}

interface RunOptions {
  locator?: FakeLocator;
  page?: FakePage;
  url?: string;
}

async function runStep(
  step: Step,
  options: RunOptions = {},
): Promise<{
  page: FakePage;
  locator: FakeLocator;
  outputs: Record<string, string>;
}> {
  const locator = options.locator ?? fakeLocator();
  const page = options.page ?? fakePage(locator, options.url);
  const outputs: Record<string, string> = {};
  await executeStep(
    page as unknown as Page,
    step,
    0,
    { guard: fakeGuard() },
    outputs,
  );
  return { page, locator, outputs };
}

async function stepFailure(
  step: Step,
  options: RunOptions = {},
): Promise<RunFailure> {
  try {
    await runStep(step, options);
  } catch (error) {
    if (isRunFailure(error)) return error;
    throw error;
  }
  throw new Error("executeStep should have thrown");
}

describe("executeStep navigate", () => {
  it("checks the allowlist and navigates", async () => {
    const step: Step = { action: "navigate", url: DEFAULT_URL };
    const { page } = await runStep(step);
    expect(page.goto).toHaveBeenCalledWith(DEFAULT_URL, {
      waitUntil: "domcontentloaded",
    });
  });

  it("reports a navigation timeout", async () => {
    const locator = fakeLocator();
    const page = fakePage(locator);
    page.goto.mockRejectedValue(
      Object.assign(new Error("timeout"), { name: "TimeoutError" }),
    );
    const failure = await stepFailure(
      { action: "navigate", url: DEFAULT_URL },
      { page },
    );
    expect(failure.code).toBe(ERROR_CODES.STEP_FAILED);
    expect(failure.message).toContain("navigation timed out");
  });

  it("reports a navigation failure", async () => {
    const locator = fakeLocator();
    const page = fakePage(locator);
    page.goto.mockRejectedValue(new Error("net::ERR_FAILED"));
    const failure = await stepFailure(
      { action: "navigate", url: DEFAULT_URL },
      { page },
    );
    expect(failure.code).toBe(ERROR_CODES.STEP_FAILED);
    expect(failure.message).toContain("navigation failed");
  });
});

describe("executeStep click", () => {
  it("clicks without a button option", async () => {
    const { locator } = await runStep({ action: "click", target: TARGET });
    expect(locator.click).toHaveBeenCalledWith();
  });

  it("clicks with the requested button", async () => {
    const { locator } = await runStep({
      action: "click",
      target: TARGET,
      button: "right",
    });
    expect(locator.click).toHaveBeenCalledWith({ button: "right" });
  });
});

describe("executeStep waitFor", () => {
  it("waits for visible by default", async () => {
    const { locator } = await runStep({ action: "waitFor", target: TARGET });
    expect(locator.waitFor).toHaveBeenCalledWith({ state: "visible" });
  });

  it("waits for the requested state", async () => {
    const { locator } = await runStep({
      action: "waitFor",
      target: TARGET,
      state: "hidden",
    });
    expect(locator.waitFor).toHaveBeenCalledWith({ state: "hidden" });
  });

  it("reports a wait timeout", async () => {
    const locator = fakeLocator({
      waitFor: mock().mockRejectedValue(
        Object.assign(new Error("timeout"), { name: "TimeoutError" }),
      ),
    });
    const failure = await stepFailure(
      { action: "waitFor", target: TARGET, state: "detached" },
      { locator },
    );
    expect(failure.code).toBe(ERROR_CODES.STEP_FAILED);
    expect(failure.message).toContain("element not detached");
  });

  it("propagates a non-timeout wait error", async () => {
    const locator = fakeLocator({
      waitFor: mock().mockRejectedValue(new Error("page crashed")),
    });
    try {
      await runStep({ action: "waitFor", target: TARGET }, { locator });
      expect.unreachable("executeStep should have thrown");
    } catch (error) {
      expect(isRunFailure(error)).toBe(false);
      expect(error).toBeInstanceOf(Error);
    }
  });
});

describe("executeStep assertVisible", () => {
  it("passes when the element is visible", async () => {
    const { locator } = await runStep({
      action: "assertVisible",
      target: TARGET,
    });
    expect(locator.waitFor).toHaveBeenCalledWith({ state: "visible" });
  });

  it("fails when the element is not visible", async () => {
    const locator = fakeLocator({
      waitFor: mock().mockRejectedValue(new Error("not visible")),
    });
    const failure = await stepFailure(
      { action: "assertVisible", target: TARGET },
      { locator },
    );
    expect(failure.code).toBe(ERROR_CODES.ASSERTION_FAILED);
  });
});

describe("executeStep assertText", () => {
  it("requires equals or contains", async () => {
    const failure = await stepFailure({
      action: "assertText",
      target: TARGET,
    });
    expect(failure.code).toBe(ERROR_CODES.STEP_FAILED);
    expect(failure.message).toContain("one of equals or contains is required");
  });

  it("passes on an exact match", async () => {
    await expect(
      runStep({
        action: "assertText",
        target: TARGET,
        equals: "Order received",
      }),
    ).resolves.toBeDefined();
  });

  it("fails on an exact mismatch", async () => {
    const failure = await stepFailure({
      action: "assertText",
      target: TARGET,
      equals: "Something else",
    });
    expect(failure.code).toBe(ERROR_CODES.ASSERTION_FAILED);
  });

  it("passes when the text contains the value", async () => {
    await expect(
      runStep({
        action: "assertText",
        target: TARGET,
        contains: "received",
      }),
    ).resolves.toBeDefined();
  });

  it("fails when the text does not contain the value", async () => {
    const failure = await stepFailure({
      action: "assertText",
      target: TARGET,
      contains: "missing",
    });
    expect(failure.code).toBe(ERROR_CODES.ASSERTION_FAILED);
  });

  it("fails when the element is missing", async () => {
    const locator = fakeLocator({
      innerText: mock().mockRejectedValue(new Error("no element")),
    });
    const failure = await stepFailure(
      { action: "assertText", target: TARGET, contains: "received" },
      { locator },
    );
    expect(failure.code).toBe(ERROR_CODES.ASSERTION_FAILED);
    expect(failure.message).toContain("element not found");
  });
});

describe("executeStep assertUrl", () => {
  it("passes when the url contains the value", async () => {
    await expect(
      runStep(
        { action: "assertUrl", contains: "/checkout" },
        { url: "http://localhost:3000/checkout" },
      ),
    ).resolves.toBeDefined();
  });

  it("fails when the url does not contain the value", async () => {
    const failure = await stepFailure(
      { action: "assertUrl", contains: "/orders" },
      { url: "http://localhost:3000/checkout" },
    );
    expect(failure.code).toBe(ERROR_CODES.ASSERTION_FAILED);
    expect(failure.message).toContain("expected url to contain");
  });

  it("passes when the url matches the value", async () => {
    await expect(
      runStep(
        { action: "assertUrl", matches: "/orders/42" },
        { url: "http://localhost:3000/orders/42" },
      ),
    ).resolves.toBeDefined();
  });

  it("fails when the url does not match the value", async () => {
    const failure = await stepFailure(
      { action: "assertUrl", matches: "/orders/7" },
      { url: "http://localhost:3000/orders/42" },
    );
    expect(failure.code).toBe(ERROR_CODES.ASSERTION_FAILED);
    expect(failure.message).toContain("expected url to match");
  });
});
