import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import readingExample from "../public/examples/reading-practice.json";
import type { Quiz } from "./models";
import { saveQuiz } from "./storage";

describe("Quiz Platform", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
    document.head.innerHTML = '<meta name="theme-color" content="#171c5b">';
    vi.restoreAllMocks();
    Object.defineProperty(document, "modelContext", { configurable: true, value: undefined });
  });

  it("applies and remembers a manually selected theme", async () => {
    localStorage.setItem("quiz-platform:theme", "dark");
    const user = userEvent.setup();
    render(<App />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    const toggle = screen.getByRole("button", { name: "Switch to light mode" });
    toggle.focus();
    await user.keyboard("[Enter]");

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("quiz-platform:theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", "#171c5b");
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
    await user.click(screen.getByRole("button", { name: "Learning material for Science" }));
    expect(screen.getByRole("heading", { name: "Science essentials" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Flow diagram" })).toHaveTextContent("Experiment");
  });

  it("opens a linked document from the library without starting a quiz", async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) { this.setAttribute("open", ""); }
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      }
    });
    saveQuiz({
      id: "lesson-quiz",
      title: "Lesson Quiz",
      learningMaterial: { passageId: "lesson" },
      passages: [{ id: "lesson", title: "Short lesson", paragraphs: ["Read this lesson first."] }],
      questions: [{ id: "q1", type: "shortText", prompt: "Ready?", acceptedAnswers: ["yes"] }],
    } satisfies Quiz);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Learning material for Lesson Quiz" }));
    expect(screen.getByRole("dialog", { name: "Short lesson" })).toHaveTextContent("Read this lesson first.");
    expect(screen.getByText("LEARNING MATERIAL")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close material" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Lesson Quiz" })).toBeInTheDocument();
  });

  it("validates and imports JSON pasted from a chatbot", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Import quiz" }));

    const pasteBox = screen.getByLabelText("Paste a chatbot response");
    await user.click(pasteBox);
    await user.paste("{");
    await user.click(screen.getByRole("button", { name: "Validate and import" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not valid JSON");

    await user.clear(pasteBox);
    await user.click(pasteBox);
    await user.paste(JSON.stringify({
      schemaVersion: 1,
      quiz: {
        id: "pasted-quiz",
        title: "Pasted Quiz",
        questions: [{ id: "q1", type: "shortText", prompt: "Ready?", acceptedAnswers: ["Yes"] }],
      },
    }));
    await user.click(screen.getByRole("button", { name: "Validate and import" }));

    expect(await screen.findByRole("heading", { name: "Pasted Quiz" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("imported");
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
    expect(screen.queryByText("Correct answer:")).not.toBeInTheDocument();
    const answerToggle = screen.getByRole("button", { name: "Show answers" });
    answerToggle.focus();
    await user.keyboard("[Space]");
    expect(screen.getAllByText("Correct answer:")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Hide answers" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
  });

  it("opens the same reading passage across questions and during review", async () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) { this.setAttribute("open", ""); }
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      }
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Import quiz" }));
    await user.click(screen.getByLabelText("Paste a chatbot response"));
    await user.paste(JSON.stringify(readingExample));
    await user.click(screen.getByRole("button", { name: "Validate and import" }));
    await user.click(screen.getByRole("button", { name: "Start Reading Practice: Urban Wetlands" }));

    await user.click(screen.getByRole("button", { name: "Read passage: The Return of Urban Wetlands" }));
    expect(screen.getByRole("dialog", { name: "The Return of Urban Wetlands" })).toHaveTextContent("city planners often drained wetlands");
    await user.click(screen.getByRole("button", { name: "Close passage" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByText("To explain why some cities restore wetlands and what those wetlands can and cannot do"));
    await user.click(screen.getByRole("button", { name: /Next question/ }));
    await user.click(screen.getByRole("button", { name: "Read passage: The Return of Urban Wetlands" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("city planners often drained wetlands");
    await user.click(screen.getByRole("button", { name: "Close passage" }));
    await user.click(screen.getByText("They hold rainwater temporarily."));
    await user.click(screen.getByText("They provide habitat for birds and insects."));
    await user.click(screen.getByRole("button", { name: /Next question/ }));
    await user.type(screen.getByLabelText("Your answer"), "native species");
    await user.click(screen.getByRole("button", { name: /Next question/ }));
    await user.click(screen.getByText("To show that wetlands work best as one part of a wider flood strategy"));
    await user.click(screen.getByRole("button", { name: "Finish quiz" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Read passage: The Return of Urban Wetlands" })[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("city planners often drained wetlands");
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
