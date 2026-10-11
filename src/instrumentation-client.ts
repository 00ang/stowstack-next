import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: "/api/audit-form",
      method: "POST",
      advancedOptions: {
        checkLevel: "deepAnalysis",
      },
    },
  ],
});
