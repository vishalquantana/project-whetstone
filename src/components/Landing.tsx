interface Props {
  onEnter: () => void;
}

export function Landing({ onEnter }: Props) {
  return (
    <div className="landing">
      <h1 className="grotesk">Keep the edge AI is dulling.</h1>
      <button className="btn" onClick={onEnter}>
        Start training
      </button>
    </div>
  );
}
