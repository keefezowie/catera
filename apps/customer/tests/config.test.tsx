import config from "../app.config";

describe("app config", () => {
  it("opts into Android predictive back, so the back swipe previews the previous screen", () => {
    expect(config.android?.predictiveBackGestureEnabled).toBe(true);
  });
});
