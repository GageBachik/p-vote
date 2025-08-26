import { createCodamaConfig } from "gill";

export default createCodamaConfig(
  {
    idl: "idl/p_vote.json",
    clientJs: "clients/js/src/generated",
  },
  {
    idl: "program/idl.json",
    before: [],
    scripts: {
      js: {
        from: "@codama/renderers-js",
        args: [
          "clients/js/src/generated",
          {
            dependencyMap: {
              solanaAccounts: "gill",
              solanaAddresses: "gill",
              solanaCodecsCore: "gill",
              solanaCodecsDataStructures: "gill",
              solanaCodecsNumbers: "gill",
              solanaCodecsStrings: "gill",
              solanaErrors: "gill",
              solanaInstructions: "gill",
              solanaOptions: "gill",
              solanaPrograms: "gill",
              solanaRpcTypes: "gill",
              solanaSigners: "gill",
            },
          },
        ],
      },
    },
  }
);
