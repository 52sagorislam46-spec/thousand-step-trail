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

  it("starts with only level 1 unlocked", async () => {
    await renderMap();
    expect(screen.getByRole("button", { name: "লেভেল 1" })).toHaveAttribute("aria-current", "true");
    expect(screen.queryByTestId("stars-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "লেভেল 2" }));
    expect(screen.queryByRole("button", { name: "খেলুন" })).not.toBeInTheDocument();
  });

  it("pressing play opens the bubble shooter game", async () => {
    await renderMap();
    fireEvent.click(screen.getByRole("button", { name: "লেভেল 1" }));
    fireEvent.click(screen.getByRole("button", { name: "খেলুন" }));
    expect(screen.getByRole("dialog", { name: "বাবল শুটার লেভেল 1" })).toBeInTheDocument();
  });
});
