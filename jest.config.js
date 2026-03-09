export default {
  testEnvironment: "node",
  projects: [
    {
      displayName: "auth-service",
      testMatch: ["<rootDir>/services/auth-service/tests/**/*.test.js"],
      transform: {
        "^.+\\.js$": "babel-jest"
      }
    },
    {
      displayName: "notes-service",
      testMatch: ["<rootDir>/services/notes-service/tests/**/*.test.js"],
      transform: {
        "^.+\\.js$": "babel-jest"
      }
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integration/**/*.test.js"],
      transform: {
        "^.+\\.js$": "babel-jest"
      }
    }
  ]
};