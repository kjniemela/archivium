const { defineConfig } = require("cypress");

module.exports = defineConfig({
  projectId: "ury9q9",
  e2e: {
    baseUrl: 'http://localhost:33004',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
