import next from "eslint-config-next/core-web-vitals";

// ESLint flat config. eslint-config-next ships its rules as a flat array
// (Next 16 removed the `next lint` command), so we consume it directly here.
const config = [
  { ignores: [".next/**", "node_modules/**"] },
  ...next,
];

export default config;
