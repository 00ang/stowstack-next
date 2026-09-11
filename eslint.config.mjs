import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name=/queryRawUnsafe|executeRawUnsafe/]",
          message: "$queryRawUnsafe and $executeRawUnsafe are banned. Use $queryRaw/$executeRaw with tagged templates or Prisma.sql instead.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next — globbed to also catch nested
    // build output (e.g. "resume webstite/.next", "resume webstite/out").
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "next-env.d.ts",
    // Generated/deployed static bundles checked into the repo.
    // The resume export is archived (hidden) at _archive/resume/ rather than
    // served from public/; keep both paths ignored.
    "public/resume/**",
    "_archive/**",
  ]),
]);

export default eslintConfig;
