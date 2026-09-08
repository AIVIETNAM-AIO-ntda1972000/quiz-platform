import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("Quiz Platform", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(document, "modelContext", { configurable: true, value: undefined });
  });

  it("imports a valid quiz and reports invalid files", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Import quiz" }));
    const input = screen.getByLabelText("Choose a JSON file");
    await user.upload(input, new File(["{"], "bad.json", { type: "application/json" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not valid JSON");

    const valid = {
      schemaVersion: 1,
      quiz: {
        id: "science",
        title: "Science",
        learningMaterial: {
          title: "Science essentials",
          sections: [{
            id: "method",
            title: "The scientific method",
            paragraphs: ["Test explanations against evidence."],
            illustration: {
              type: "flow",
              items: [{ label: "Question" }, { label: "Experiment" }, { label: "Evidence" }]
            }
          }]
        },
        questions: [{ id: "q1", type: "shortText", prompt: "Planet?", acceptedAnswers: ["Earth"] }]
      }
    };
    await user.upload(input, new File([JSON.stringify(valid)], "science.json", { type: "application/json" }));
    expect(await screen.findByText("Science")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("imported");
    await user.click(screen.getByRole("button", { name: "Study Science" }));
    expect(screen.getByRole("heading", { name: "Science essentials" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Flow diagram" })).toHaveTextContent("Experiment");
  });

  it("completes a quiz, reviews results, and retries", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Start Basic Mathematics" }));
    await user.click(screen.getByText("4"));
    await user.click(screen.getByRole("button", { name: /Next question/ }));
    await user.click(screen.getByText("2"));
    await user.click(screen.getByText("4"));
    await user.click(screen.getByRole("button", { name: /Next question/ }));
    await user.type(screen.getByLabelText("Your answer"), "  PARIS ");
    await user.click(screen.getByRole("button", { name: "Finish quiz" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Correct")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
  });

  it("restores an interrupted attempt", async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    await user.click(screen.getByRole("button", { name: "Start Basic Mathematics" }));
    await user.click(screen.getByText("4"));
    await user.click(screen.getByRole("button", { name: /Next question/ }));
    view.unmount();
    render(<App />);
    expect(screen.getByRole("button", { name: "Resume Basic Mathematics" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume Basic Mathematics" }));
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
  });

  it("searches and deletes quizzes with confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    await user.type(screen.getByRole("searchbox", { name: "Search quizzes" }), "missing");
    expect(screen.getByText("No quizzes match your search.")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search quizzes" }));
    await user.click(screen.getByRole("button", { name: "Delete Basic Mathematics" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByText("Your library is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Basic Mathematics" })).not.toBeInTheDocument();
  });

  it("registers WebMCP tools and imports through the same app action", async () => {
    const tools: Array<{ name: string; execute(input: unknown): unknown }> = [];
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: (tool: typeof tools[number]) => tools.push(tool) } });
    render(<App />);
    await waitFor(() => expect(tools.some((tool) => tool.name === "import_quiz")).toBe(true));
    const importTool = tools.find((tool) => tool.name === "import_quiz")!;
    await importTool.execute({ payload: { schemaVersion: 1, quiz: { id: "agent-quiz", title: "Agent Quiz", questions: [{ id: "q", type: "shortText", prompt: "Answer", acceptedAnswers: ["Yes"] }] } } });
    expect(await screen.findByText("Agent Quiz")).toBeInTheDocument();
    expect(() => importTool.execute({ payload: {} })).toThrow();
  });
});
