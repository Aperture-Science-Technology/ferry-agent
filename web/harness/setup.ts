/**
 * Load the real app stylesheet so harness renders use project tokens/utilities.
 * Reset Testing Library DOM between tests so renders do not leak across cases.
 */
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "../app/globals.css";

afterEach(cleanup);
