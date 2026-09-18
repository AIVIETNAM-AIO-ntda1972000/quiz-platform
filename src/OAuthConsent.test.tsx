import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OAuthConsent, type OAuthConsentService } from "./OAuthConsent";

function service(overrides: Partial<OAuthConsentService> = {}): OAuthConsentService {
  return {
    configured: true,
    hasSession: vi.fn().mockResolvedValue(true),
    signIn: vi.fn().mockResolvedValue({ ok: true }),
    getDetails: vi.fn().mockResolvedValue({
      details: {
        authorizationId: "authorization-1",
        clientName: "Quiz Assistant",
        clientUri: "https://example.com",
        redirectUri: "https://example.com/callback",
        scopes: ["openid", "profile"],
      },
    }),
    decide: vi.fn().mockResolvedValue({ redirectUrl: "https://example.com/complete" }),
    ...overrides,
  };
}

describe("OAuthConsent", () => {
  it("reports a missing authorization request", async () => {
    render(<OAuthConsent authorizationId={null} service={service()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Missing authorization_id");
  });

  it("signs in while preserving the request and approves the client", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const consentService = service({ hasSession: vi.fn().mockResolvedValue(false) });
    render(<OAuthConsent authorizationId="authorization-1" service={consentService} navigate={navigate} />);

    await user.type(await screen.findByLabelText("Username"), "learner");
    await user.type(screen.getByLabelText("Password"), "secret12");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Quiz Assistant wants to connect" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve connection" }));

    expect(consentService.signIn).toHaveBeenCalledWith("learner", "secret12");
    expect(consentService.getDetails).toHaveBeenCalledWith("authorization-1");
    expect(consentService.decide).toHaveBeenCalledWith("authorization-1", "approve");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://example.com/complete"));
  });

  it("returns denial to the requesting client", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const consentService = service();
    render(<OAuthConsent authorizationId="authorization-1" service={consentService} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: "Deny" }));
    expect(consentService.decide).toHaveBeenCalledWith("authorization-1", "deny");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://example.com/complete"));
  });
});
