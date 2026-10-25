import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LevelMapPage } from "@/routes/index";

async function renderMap() {
  render(<LevelMapPage />);
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: /^লেভেল \d+$/ })).toHaveLength(1000),
  );
}

afterEach(() => {
  localStorage.clear();
  cleanup();
});

describe("Level map", { timeout: 90_000 }, () => {
  it("renders all 1000 levels", async () => {
    await renderMap();
    expect(screen.getAllByRole("button", { name: /^লেভেল \d+$/ })).toHaveLength(1000);
  });

  it("starts with levels 1–5 completed and level 6 as the current level", async () => {
    await renderMap();
    expect(screen.getByTestId("stars-1")).toBeInTheDocument();
    expect(screen.getByTestId("stars-5")).toBeInTheDocument();
    expect(screen.queryByTestId("stars-6")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "লেভেল 6" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("playing a level earns 3 stars and unlocks the next level", async () => {
    await renderMap();
    fireEvent.click(screen.getByRole("button", { name: "লেভেল 6" }));
    fireEvent.click(screen.getByRole("button", { name: "খেলুন" }));
    await waitFor(() => expect(screen.getByTestId("stars-6")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "লেভেল 7" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
