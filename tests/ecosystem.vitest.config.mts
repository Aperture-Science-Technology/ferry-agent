import config from "../web/vitest.config.mts";

// Additional UI regressions within the FA-ECOSYSTEM-01 authorized directories.
// Run from web: npx vitest run --config ../tests/ecosystem.vitest.config.mts
export default {
  ...config,
  test: {
    ...config.test,
    include: [
      "components/app/gateways/gateway-version.test.tsx",
      "components/app/settings/opds-limits.test.tsx",
    ],
  },
};
