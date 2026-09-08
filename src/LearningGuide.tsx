import type { LearningIllustration, LearningMaterial } from "./models";

type LearningGuideProps = {
  material: LearningMaterial;
  quizTitle: string;
  onBack: () => void;
};

function FlowIllustration({ illustration }: { illustration: Extract<LearningIllustration, { type: "flow" }> }) {
  return (
    <div className="material-illustration flow-illustration" role="img" aria-label={illustration.title ?? "Flow diagram"}>
      {illustration.title && <h3>{illustration.title}</h3>}
      <div className="flow-items">
        {illustration.items.map((item, index) => (
          <div className="flow-item" key={`${item.label}-${index}`}>
            <span>{index + 1}</span>
            <div><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonIllustration({ illustration }: { illustration: Extract<LearningIllustration, { type: "comparison" }> }) {
  return (
    <div className="material-illustration comparison-illustration" role="img" aria-label={illustration.title ?? "Comparison diagram"}>
      {illustration.title && <h3>{illustration.title}</h3>}
      <div className="comparison-items">
        {illustration.items.map((item, index) => (
          <div className={`comparison-item ${item.highlight ? "highlight" : ""}`} key={`${item.label}-${index}`}>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionIllustration({ illustration }: { illustration: Extract<LearningIllustration, { type: "distribution" }> }) {
  const labels = [...new Set(illustration.groups.flatMap((group) => group.segments.map((segment) => segment.label)))];
  return (
    <div className="material-illustration distribution-illustration" role="img" aria-label={illustration.title ?? "Distribution diagram"}>
      {illustration.title && <h3>{illustration.title}</h3>}
      <div className="distribution-legend">
        {labels.map((label, index) => <span key={label}><i className={`segment-color color-${index % 6}`} />{label}</span>)}
      </div>
      <div className="distribution-groups">
        {illustration.groups.map((group, groupIndex) => {
          const total = group.segments.reduce((sum, segment) => sum + segment.count, 0);
          return (
            <div className="distribution-group" key={`${group.label}-${groupIndex}`}>
              <div className="distribution-label"><strong>{group.label}</strong>{group.note && <small>{group.note}</small>}</div>
              <div className="distribution-bar">
                {group.segments.map((segment, segmentIndex) => {
                  const colorIndex = labels.indexOf(segment.label) % 6;
                  return <span key={`${segment.label}-${segmentIndex}`} className={`color-${colorIndex}`} style={{ width: `${(segment.count / total) * 100}%` }} title={`${segment.label}: ${segment.count}`} />;
                })}
              </div>
              <span className="distribution-total">{total} total</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Illustration({ illustration }: { illustration: LearningIllustration }) {
  if (illustration.type === "flow") return <FlowIllustration illustration={illustration} />;
  if (illustration.type === "comparison") return <ComparisonIllustration illustration={illustration} />;
  return <DistributionIllustration illustration={illustration} />;
}

export function LearningGuide({ material, quizTitle, onBack }: LearningGuideProps) {
  return (
    <main className="guide-page">
      <button className="back-link" type="button" onClick={onBack}>← Back to library</button>
      <section className="guide-hero">
        <p className="eyebrow">STUDY GUIDE · {quizTitle.toUpperCase()}</p>
        <h1 tabIndex={-1}>{material.title}</h1>
        {material.summary && <p>{material.summary}</p>}
        <nav className="guide-toc" aria-label="Study guide sections">
          {material.sections.map((section, index) => <a href={`#material-${section.id}`} key={section.id}>{index + 1}. {section.title}</a>)}
        </nav>
      </section>

      <article className="guide-content">
        {material.sections.map((section, index) => (
          <section className={`guide-section ${section.illustration ? "with-illustration" : "full-width"}`} id={`material-${section.id}`} key={section.id}>
            <div className="guide-copy">
              <p className="guide-step">{String(index + 1).padStart(2, "0")} · CONCEPT</p>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
              {section.keyPoints && (
                <ul className="key-points">
                  {section.keyPoints.map((point) => <li key={point}>{point}</li>)}
                </ul>
              )}
            </div>
            {section.illustration && <Illustration illustration={section.illustration} />}
          </section>
        ))}
      </article>

      <div className="guide-footer">
        <button className="primary-button" type="button" onClick={onBack}>Return to quiz library</button>
      </div>
    </main>
  );
}
