// Next.js 16 usa flat config nativo do eslint-config-next.
// "core-web-vitals" já inclui a base (next/typescript + react/react-hooks/import/jsx-a11y).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [".next/**", "node_modules/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
