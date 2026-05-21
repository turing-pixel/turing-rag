import eslintConfigNext from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...eslintConfigNext,
  {
    rules: {
      // Next 16 / react-hooks compiler rules; existing app patterns trigger false positives.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
  {
    files: ["eslint.config.mjs"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default config;
