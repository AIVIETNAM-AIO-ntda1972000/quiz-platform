import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuizInbox } from "./QuizInboxPanel";
import type { QuizInboxItem } from "./quizInbox";

const item: QuizInboxItem = {
  id: "submission-1",
  userId: "user-1",
  quizId: "agent-science",
  title: "Agent Science",
  payload: {
    schemaVersion: 1,
    quiz: {
      id: "agent-science",
      title: "Agent Science",
      description: "A generated science quiz",
      questions: [{ id: "q1", type: "shortText", prompt: "Which planet is our home?", acceptedAnswers: ["Earth"] }],
    },
  },
  status: "pending",
  sourceClientId: "chat-client",
  createdAt: "2026-09-18T00:00:00.000Z",
};

describe("QuizInbox", () => {
  it("previews and routes review actions", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const onDelete = vi.fn();
    render(<QuizInbox items={[item]} loading={false} message="" onAccept={onAccept} onReject={onReject} onDelete={onDelete} onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Agent Science" })).toBeInTheDocument();
    await user.click(screen.getByText("Preview contents"));
    expect(screen.getByText("Which planet is our home?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept quiz" }));
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onAccept).toHaveBeenCalledWith(item);
    expect(onReject).toHaveBeenCalledWith(item);
    expect(onDelete).toHaveBeenCalledWith(item);
  });

  it("announces loading and empty states", () => {
    render(<QuizInbox items={[]} loading message="No submissions." onAccept={vi.fn()} onReject={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getAllByRole("status").map((node) => node.textContent)).toEqual(["No submissions.", "Loading submissions…"]);
  });
});
