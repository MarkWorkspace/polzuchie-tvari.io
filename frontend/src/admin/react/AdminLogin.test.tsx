// @vitest-environment jsdom
// ROLE: Regression tests for the React admin login form.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLogin } from "./AdminLogin";

afterEach(cleanup);

describe("AdminLogin", () => {
  it("submits the entered password", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AdminLogin error="" isSubmitting={false} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Admin password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Authorize" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("secret"));
  });

  it("shows the server error", () => {
    render(<AdminLogin error="Invalid admin password" isSubmitting={false} onSubmit={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Invalid admin password");
  });
});
