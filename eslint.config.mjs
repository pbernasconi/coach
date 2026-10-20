import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "ios-standards/**",
      "lift/ios/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
    },
  },
  {
    // Database times go through src/lib/db-time.mjs (the 2026-10-19 outage was a local helper that added 'Z' to
    // '…+00'). These selectors block local copies of that helper and the two patterns that caused it.
    files: ["src/**/*.{ts,tsx,mjs,js}"],
    ignores: [
      "src/lib/db-time.mjs",
      "src/**/*.test.mjs",
      // Not yet moved to db-time (owned by another branch of work); remove each entry once it imports db-time.
      "src/app/api/home/route.ts",
      "src/lib/calendar-sync/push.mjs",
      "src/lib/calendar-sync/events.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "VariableDeclarator[id.name=/^(day|iso|toDay|toIso|toDate)$/][init.type='ArrowFunctionExpression']",
          message: "Use toDay/toIso/toDate from src/lib/db-time.mjs to read database times.",
        },
        {
          selector: "FunctionDeclaration[id.name=/^(day|iso)$/]",
          message: "Use toDay/toIso/toDate from src/lib/db-time.mjs to read database times.",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.0.type='CallExpression'][arguments.0.callee.name='String']",
          message: "new Date(String(value)) breaks on Postgres text such as '…+00'. Use toDate from src/lib/db-time.mjs.",
        },
        {
          selector: "NewExpression[callee.name='Date'] > TemplateLiteral > TemplateElement[tail=true][value.raw='Z']",
          message: "Adding 'Z' to a database time breaks on '…+00' (the 2026-10-19 outage). Use toIso from src/lib/db-time.mjs.",
        },
      ],
    },
  },
];

export default eslintConfig;
