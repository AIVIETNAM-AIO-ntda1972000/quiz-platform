import type { QuizInboxItem } from "./quizInbox";

type QuizInboxProps = {
  items: QuizInboxItem[];
  loading: boolean;
  message: string;
  onAccept: (item: QuizInboxItem) => void;
  onReject: (item: QuizInboxItem) => void;
  onDelete: (item: QuizInboxItem) => void;
  onBack: () => void;
};

export function QuizInbox({ items, loading, message, onAccept, onReject, onDelete, onBack }: QuizInboxProps) {
  return (
    <main className="narrow-page">
      <button className="back-link" type="button" onClick={onBack}>← Back to library</button>
      <p className="eyebrow">AI QUIZ INBOX</p>
      <h1 tabIndex={-1}>Review new quizzes</h1>
      <p className="lead">Connected AI assistants send drafts here. Nothing enters your library until you accept it.</p>
      {message && <div className="sync-status" role="status">{message}</div>}
      {loading && <div className="sync-status" role="status">Loading submissions…</div>}
      <section className="inbox-list" aria-label="Pending AI quizzes">
        {items.map((item) => {
          const quiz = item.payload.quiz;
          return (
            <article className="inbox-card" key={item.id}>
              <div className="inbox-heading">
                <div>
                  <span className="card-label">PENDING REVIEW</span>
                  <h2>{item.title}</h2>
                </div>
                <span>{quiz.questions.length} questions</span>
              </div>
              <p>{quiz.description ?? "No description provided."}</p>
              <div className="inbox-meta">
                <span>ID: {item.quizId}</span>
                <span>Source: {item.sourceClientId ?? "AI assistant"}</span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <details>
                <summary>Preview contents</summary>
                {quiz.learningMaterial && <p><strong>Study guide:</strong> {quiz.learningMaterial.sections.length} sections</p>}
                <ol>{quiz.questions.map((question) => <li key={question.id}>{question.prompt}</li>)}</ol>
              </details>
              <div className="inbox-actions">
                <button className="primary-button" type="button" onClick={() => onAccept(item)}>Accept quiz</button>
                <button className="secondary-button" type="button" onClick={() => onReject(item)}>Reject</button>
                <button className="delete-button" type="button" onClick={() => onDelete(item)}>Delete</button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
