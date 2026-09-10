import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCloudConfigured, useCloudSync } from "./cloudSync";
import { exampleQuizFile } from "./exampleQuiz";
import { gradeQuiz, isCorrect } from "./grading";
import { LearningGuide } from "./LearningGuide";
import type { Answer, Attempt, Question, Quiz, QuizFile, QuizResult } from "./models";
import { parseQuizJson } from "./quizSchema";
import { clearAttempt, clearQuizProgress, deleteQuiz, initializeQuizLibrary, loadAttempt, loadQuizzes, loadResult, saveAttempt, saveQuiz, saveResult } from "./storage";
import { applyTheme, getSavedTheme, getThemeMediaQuery, resolveTheme, saveThemePreference, type Theme } from "./theme";
import { useWebMcp } from "./webMcp";

type Screen = "library" | "import" | "attempt" | "results" | "account" | "learn";

function initialQuizzes(): Quiz[] {
  return initializeQuizLibrary(exampleQuizFile.quiz);
}

function hasAnswer(answer: Answer | undefined): boolean {
  return typeof answer === "string" ? answer.trim().length > 0 : Array.isArray(answer) && answer.length > 0;
}

function correctAnswerText(question: Question): string {
  if (question.type === "shortText") return question.acceptedAnswers.join(" / ");
  const ids = question.type === "singleChoice" ? [question.correctOptionId] : question.correctOptionIds;
  return question.options.filter((option) => ids.includes(option.id)).map((option) => option.text).join(", ");
}

function userAnswerText(question: Question, answer: Answer | undefined): string {
  if (!hasAnswer(answer)) return "No answer";
  if (question.type === "shortText") return String(answer);
  const ids = Array.isArray(answer) ? answer : [answer];
  return question.options.filter((option) => ids.includes(option.id)).map((option) => option.text).join(", ");
}

export default function App() {
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [screen, setScreen] = useState<Screen>("library");
  const [activeQuiz, setActiveQuiz] = useState<Quiz>();
  const [attempt, setAttempt] = useState<Attempt>();
  const [result, setResult] = useState<QuizResult>();
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [theme, setTheme] = useState<Theme>(resolveTheme);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const refreshLibrary = useCallback(() => setQuizzes(loadQuizzes()), []);
  const cloud = useCloudSync(refreshLibrary);
  const filteredQuizzes = useMemo(() => {
    const query = searchQuery.normalize("NFKC").trim().toLocaleLowerCase();
    if (!query) return quizzes;
    return quizzes.filter((quiz) => [quiz.title, quiz.description, quiz.id]
      .some((value) => value?.normalize("NFKC").toLocaleLowerCase().includes(query)));
  }, [quizzes, searchQuery]);

  useEffect(() => { headingRef.current?.focus(); }, [screen, attempt?.currentIndex]);

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    const mediaQuery = getThemeMediaQuery();
    if (!mediaQuery) return;
    const followSystemTheme = (event: MediaQueryListEvent) => {
      if (!getSavedTheme()) setTheme(event.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", followSystemTheme);
    return () => mediaQuery.removeEventListener("change", followSystemTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    saveThemePreference(nextTheme);
    setTheme(nextTheme);
  };

  const importValidatedQuiz = useCallback((file: QuizFile, replace: boolean) => {
    const exists = loadQuizzes().some((quiz) => quiz.id === file.quiz.id);
    if (exists && !replace) throw new Error("A quiz with this id already exists.");
    if (exists) clearQuizProgress(file.quiz.id);
    saveQuiz(file.quiz);
    refreshLibrary();
    setNotice(`${file.quiz.title} was ${exists ? "replaced" : "imported"}.`);
    setScreen("library");
  }, [refreshLibrary]);

  useWebMcp(quizzes, importValidatedQuiz);

  const goHome = () => {
    setImportErrors([]);
    setNotice("");
    setScreen("library");
  };

  const startQuiz = (quiz: Quiz, fresh = false) => {
    if (fresh) clearAttempt(quiz.id);
    const saved = fresh ? undefined : loadAttempt(quiz.id);
    const nextAttempt: Attempt = saved ?? { quizId: quiz.id, answers: {}, currentIndex: 0, updatedAt: new Date().toISOString() };
    setActiveQuiz(quiz);
    setAttempt(nextAttempt);
    setScreen("attempt");
  };

  const openLearningMaterial = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setScreen("learn");
  };

  const updateAnswer = (questionId: string, answer: Answer) => {
    if (!attempt) return;
    const next = { ...attempt, answers: { ...attempt.answers, [questionId]: answer }, updatedAt: new Date().toISOString() };
    setAttempt(next);
    saveAttempt(next);
  };

  const moveTo = (index: number) => {
    if (!attempt || !activeQuiz) return;
    const next = { ...attempt, currentIndex: Math.max(0, Math.min(index, activeQuiz.questions.length - 1)), updatedAt: new Date().toISOString() };
    setAttempt(next);
    saveAttempt(next);
  };

  const finishQuiz = () => {
    if (!attempt || !activeQuiz) return;
    const nextResult = gradeQuiz(activeQuiz, attempt.answers);
    saveResult(nextResult);
    clearAttempt(activeQuiz.id);
    setResult(nextResult);
    setScreen("results");
  };

  const handleFile = async (file?: File) => {
    setImportErrors([]);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setImportErrors(["file: Choose a .json file"]);
      return;
    }
    const validation = parseQuizJson(await file.text());
    if (!validation.success) {
      setImportErrors(validation.errors);
      return;
    }
    const exists = quizzes.some((quiz) => quiz.id === validation.data.quiz.id);
    if (exists && !window.confirm(`Replace “${validation.data.quiz.title}” and clear its saved progress?`)) return;
    importValidatedQuiz(validation.data, exists);
  };

  const handleDeleteQuiz = (quiz: Quiz) => {
    if (!window.confirm(`Delete “${quiz.title}” and all of its saved progress?`)) return;
    deleteQuiz(quiz.id);
    refreshLibrary();
    setNotice(`${quiz.title} was deleted.`);
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await cloud.signIn(username, password)) setPassword("");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={goHome} aria-label="Quiz Platform home">
          <span className="brand-mark">Q</span><span>Quiz Platform</span>
        </button>
        <div className="topbar-actions">
          <span className="offline-pill"><span className="status-dot" /> Offline ready</span>
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
          </button>
          <button className="sync-button" type="button" onClick={() => setScreen("account")}>
            {cloud.user ? `Sync: ${cloud.status}` : "Cloud sync"}
          </button>
        </div>
      </header>

      {screen === "library" && (
        <main className="page">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">YOUR QUIZ LIBRARY</p>
              <h1 ref={headingRef} tabIndex={-1}>What will you learn today?</h1>
              <p>Import an AI-generated quiz with an optional study guide, practise at your pace, and keep your progress on this device.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => setScreen("import")}>Import quiz</button>
          </section>
          {notice && <div className="notice" role="status">✓ {notice}</div>}
          <div className="library-tools">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">Search quizzes</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title, description, or ID"
              />
            </label>
            <span>{filteredQuizzes.length} of {quizzes.length} quizzes</span>
          </div>
          <section className="quiz-list" aria-label="Your quizzes">
            {filteredQuizzes.map((quiz, index) => {
              const saved = loadAttempt(quiz.id);
              const latest = loadResult(quiz.id);
              return (
                <article className="quiz-card" key={quiz.id}>
                  <div className="quiz-number">{String(index + 1).padStart(2, "0")}</div>
                  <div className="quiz-card-content">
                    <span className="card-label">{saved ? "IN PROGRESS" : latest ? "COMPLETED" : "READY TO START"}</span>
                    <h2>{quiz.title}</h2>
                    {quiz.description && <p>{quiz.description}</p>}
                    <div className="quiz-meta">
                      <span>{quiz.questions.length} questions</span>
                      <span>{saved ? `${saved.currentIndex + 1} of ${quiz.questions.length}` : latest ? `${latest.correct}/${latest.total} correct` : "Not started"}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    {quiz.learningMaterial && (
                      <button className="study-button" type="button" onClick={() => openLearningMaterial(quiz)} aria-label={`Study ${quiz.title}`}>Study guide</button>
                    )}
                    <button className="arrow-button" type="button" onClick={() => startQuiz(quiz)} aria-label={`${saved ? "Resume" : "Start"} ${quiz.title}`}>
                      <span>{saved ? "Resume" : "Start"}</span><b aria-hidden="true">→</b>
                    </button>
                    <button className="delete-button" type="button" onClick={() => handleDeleteQuiz(quiz)} aria-label={`Delete ${quiz.title}`}>Delete</button>
                  </div>
                </article>
              );
            })}
            {filteredQuizzes.length === 0 && (
              <div className="empty-state">
                <strong>{quizzes.length ? "No quizzes match your search." : "Your library is empty."}</strong>
                <span>{quizzes.length ? "Try a different keyword." : "Import a JSON quiz to get started."}</span>
              </div>
            )}
          </section>
        </main>
      )}

      {screen === "learn" && activeQuiz?.learningMaterial && (
        <LearningGuide material={activeQuiz.learningMaterial} quizTitle={activeQuiz.title} onBack={goHome} />
      )}

      {screen === "account" && (
        <main className="narrow-page">
          <button className="back-link" type="button" onClick={goHome}>← Back to library</button>
          <p className="eyebrow">CROSS-DEVICE SYNC</p>
          <h1 ref={headingRef} tabIndex={-1}>Cloud sync</h1>
          {!isCloudConfigured ? (
            <div className="account-panel">
              <h2>Supabase setup required</h2>
              <p>Add the Supabase project URL and anonymous key to the app environment. Your quizzes remain safely available on this device until cloud sync is configured.</p>
              <code>VITE_SUPABASE_URL</code>
              <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
            </div>
          ) : cloud.user ? (
            <div className="account-panel">
              <h2>Signed in</h2>
              <p>{String(cloud.user.user_metadata.username ?? "Quiz user")}</p>
              <div className={`sync-status ${cloud.status}`} role="status">{cloud.message}</div>
              <div className="account-actions">
                <button className="primary-button" type="button" onClick={() => void cloud.syncNow()}>Sync now</button>
                <button className="secondary-button" type="button" onClick={() => void cloud.signOut()}>Sign out</button>
              </div>
            </div>
          ) : (
            <form className="account-panel" onSubmit={(event) => void handleSignIn(event)}>
              <h2>Sign in on every device</h2>
              <p>Use the same username and password on your phone and computer. No email address is required.</p>
              <label>Username<input type="text" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
              <label>Password<input type="password" autoComplete="current-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <div className={`sync-status ${cloud.status}`} role="status">{cloud.message}</div>
              <div className="account-actions">
                <button className="primary-button" type="submit">Sign in</button>
                <button className="secondary-button" type="button" onClick={(event) => {
                  if (event.currentTarget.form?.reportValidity()) void cloud.signUp(username, password);
                }}>Create account</button>
              </div>
            </form>
          )}
        </main>
      )}

      {screen === "import" && (
        <main className="narrow-page">
          <button className="back-link" type="button" onClick={goHome}>← Back to library</button>
          <p className="eyebrow">ADD NEW MATERIAL</p>
          <h1 ref={headingRef} tabIndex={-1}>Import a quiz</h1>
          <p className="lead">Choose a JSON file created from our template. It is validated on your device before anything is saved.</p>
          <label className="file-drop">
            <span className="upload-icon" aria-hidden="true">↑</span>
            <strong>Choose a JSON file</strong>
            <span>One quiz and optional study guide per file · processed locally</span>
            <input aria-label="Choose a JSON file" type="file" accept="application/json,.json" onChange={(event) => { void handleFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          </label>
          {importErrors.length > 0 && (
            <div className="error-box" role="alert">
              <strong>We could not import this file</strong>
              <ul>{importErrors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          )}
          <div className="resource-row">
            <div><strong>Need a starting point?</strong><span>Download the example or use the AI prompt.</span></div>
            <div className="resource-actions">
              <a href={`${import.meta.env.BASE_URL}examples/basic-math.json`} download>Example JSON</a>
              <a href={`${import.meta.env.BASE_URL}AI_PROMPT.md`} download>AI prompt</a>
            </div>
          </div>
        </main>
      )}

      {screen === "attempt" && activeQuiz && attempt && (() => {
        const question = activeQuiz.questions[attempt.currentIndex];
        const answer = attempt.answers[question.id];
        const progress = ((attempt.currentIndex + 1) / activeQuiz.questions.length) * 100;
        return (
          <main className="attempt-page">
            <div className="attempt-header">
              <button className="back-link" type="button" onClick={goHome}>← Save & leave</button>
              <span>Question {attempt.currentIndex + 1} of {activeQuiz.questions.length}</span>
            </div>
            <div className="progress-track" aria-label={`${Math.round(progress)}% complete`}><span style={{ width: `${progress}%` }} /></div>
            <section className="question-panel">
              <p className="eyebrow">{question.type === "singleChoice" ? "CHOOSE ONE ANSWER" : question.type === "multipleChoice" ? "CHOOSE ALL THAT APPLY" : "TYPE YOUR ANSWER"}</p>
              <h1 ref={headingRef} tabIndex={-1}>{question.prompt}</h1>
              {question.type === "shortText" ? (
                <label className="text-answer">
                  <span>Your answer</span>
                  <input autoComplete="off" value={typeof answer === "string" ? answer : ""} onChange={(event) => updateAnswer(question.id, event.target.value)} placeholder="Type your answer here" />
                </label>
              ) : (
                <fieldset className="choice-list">
                  <legend className="sr-only">Answer choices</legend>
                  {question.options.map((option) => {
                    const checked = question.type === "singleChoice" ? answer === option.id : Array.isArray(answer) && answer.includes(option.id);
                    return (
                      <label className={`choice ${checked ? "selected" : ""}`} key={option.id}>
                        <input
                          type={question.type === "singleChoice" ? "radio" : "checkbox"}
                          name={question.id}
                          checked={checked}
                          onChange={() => {
                            if (question.type === "singleChoice") updateAnswer(question.id, option.id);
                            else {
                              const current = Array.isArray(answer) ? answer : [];
                              updateAnswer(question.id, checked ? current.filter((id) => id !== option.id) : [...current, option.id]);
                            }
                          }}
                        />
                        <span className="choice-key">{option.id.toUpperCase()}</span><span>{option.text}</span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </section>
            <div className="attempt-actions">
              <button className="secondary-button" type="button" onClick={() => moveTo(attempt.currentIndex - 1)} disabled={attempt.currentIndex === 0}>Previous</button>
              {attempt.currentIndex === activeQuiz.questions.length - 1
                ? <button className="primary-button" type="button" onClick={finishQuiz}>Finish quiz</button>
                : <button className="primary-button" type="button" onClick={() => moveTo(attempt.currentIndex + 1)}>Next question →</button>}
            </div>
          </main>
        );
      })()}

      {screen === "results" && activeQuiz && result && (
        <main className="results-page">
          <section className="score-card">
            <div className="score-ring"><strong>{Math.round((result.correct / result.total) * 100)}%</strong><span>score</span></div>
            <div>
              <p className="eyebrow">QUIZ COMPLETE</p>
              <h1 ref={headingRef} tabIndex={-1}>{result.correct === result.total ? "Excellent work." : "Good effort. Keep going."}</h1>
              <p>You answered {result.correct} of {result.total} questions correctly in {activeQuiz.title}.</p>
            </div>
          </section>
          <section className="review-section">
            <div className="section-heading"><h2>Review your answers</h2><span>{result.correct}/{result.total} correct</span></div>
            {activeQuiz.questions.map((question, index) => {
              const answer = result.answers[question.id];
              const correct = isCorrect(question, answer);
              return (
                <article className={`review-card ${correct ? "correct" : "incorrect"}`} key={question.id}>
                  <div className="review-status" aria-label={correct ? "Correct" : "Incorrect"}>{correct ? "✓" : "×"}</div>
                  <div>
                    <span className="card-label">QUESTION {index + 1}</span>
                    <h3>{question.prompt}</h3>
                    <p><b>Your answer:</b> {userAnswerText(question, answer)}</p>
                    {!correct && <p><b>Correct answer:</b> {correctAnswerText(question)}</p>}
                    {question.explanation && <p className="explanation">{question.explanation}</p>}
                  </div>
                </article>
              );
            })}
          </section>
          <div className="result-actions">
            <button className="secondary-button" type="button" onClick={goHome}>Back to library</button>
            <button className="primary-button" type="button" onClick={() => startQuiz(activeQuiz, true)}>Try again</button>
          </div>
        </main>
      )}
    </div>
  );
}
