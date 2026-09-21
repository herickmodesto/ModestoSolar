const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function EstimateRange({ id, min, max, step, value, onChange, minLabel, maxLabel, ariaLabel }) {
  const progress = clamp(((value - min) / (max - min)) * 100, 0, 100);

  return <div className="estimate-range-control">
    <div className="estimate-range-row">
      <div className="estimate-range-track">
        <input className="estimate-range-input" id={id} type="range" min={min} max={max} step={step} value={value} onChange={onChange} aria-label={ariaLabel} style={{ "--estimate-progress": `${progress}%` }}/>
      </div>
      <span className="estimate-range-percent" aria-hidden="true">{Math.round(progress)}%</span>
    </div>
    <div className="estimate-range-scale"><span>{minLabel}</span><span>{maxLabel}</span></div>
  </div>;
}
