import config from "../app.config";

describe("app config", () => {
  it("opts into Android predictive back", () => {
    expect(config.android?.predictiveBackGestureEnabled).toBe(true);
  });
});
