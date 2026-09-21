import { useEffect, useRef } from "react";
import "../styles/generation-analysis.css";
import { trackConversion } from "../lib/conversion-events";

const weeklyFactors = [.76, .9, .83, 1.04, .94, 1.1, .98];

function TrendIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>;
}

export default function GenerationAnalysis({ simulation, onClose, onContact }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const data = simulation || { property: "Casa térrea", bill: 600, panels: 9, installedPower: 4.95, monthlyGeneration: 644, estimatedSavings: 510, monthlyConsumption: 632, solarAccess: 100, shadingLoss: 0 };
  const dailyAverage = data.monthlyGeneration / 30;
  const week = weeklyFactors.map((factor) => Math.max(1, Math.round(dailyAverage * factor)));
  const maxDay = Math.max(...week);
  const coverage = Math.min(100, Math.round((data.monthlyGeneration / Math.max(1, data.monthlyConsumption)) * 100));
  const analysisMessage = [
    "Olá, Modesto Energias Renováveis! Concluí a simulação no site.",
    `Imóvel: ${data.property}`,
    `Conta média: R$ ${data.bill.toLocaleString("pt-BR")}`,
    `Sistema montado: ${data.panels} painéis (${data.installedPower.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp)`,
    `Geração estimada: ${data.monthlyGeneration.toLocaleString("pt-BR")} kWh/mês`,
    `Economia indicativa: R$ ${data.estimatedSavings.toLocaleString("pt-BR")}/mês`,
    `Acesso solar estimado: ${data.solarAccess ?? 100}% (${data.shadingLoss ?? 0}% de perdas por sombra)`,
    data.vehicle ? `Recarga incluída: ${data.vehicle.dailyDistance} km/dia · ${Math.round(data.vehicle.monthlyEnergy)} kWh/mês` : "Sem recarga adicional incluída.",
    "Gostaria de solicitar a análise técnica de viabilidade.",
  ].join("\n");

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    document.body.classList.add("analysis-open");
    requestAnimationFrame(() => closeRef.current?.focus());
    const handleKey = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("analysis-open");
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return <div className="generation-analysis-modal" id="analise-geracao" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose?.()}>
      <article ref={dialogRef} className="performance-card analysis-modal-panel" role="dialog" aria-modal="true" aria-labelledby="generation-analysis-title" tabIndex="-1">
        <div className="performance-card__glow"/>
        <div className="performance-card__surface">
          <button ref={closeRef} className="analysis-modal-close" type="button" onClick={onClose} aria-label="Fechar análise e voltar ao simulador"><CloseIcon/></button>
          <header className="performance-header">
            <div className="performance-title"><span><TrendIcon/></span><div><small>RESULTADO DA SIMULAÇÃO</small><h3 id="generation-analysis-title">Análise de geração</h3></div></div>
            <span className="performance-status"><i/> Atualizada</span>
          </header>
          <p className="analysis-explanation">Veja o potencial do sistema que você montou. A equipe verifica o telhado, as sombras e seu histórico de consumo para confirmar o dimensionamento.</p>
          <div className="performance-metrics">
            <div><span>Geração mensal possível</span><strong>{data.monthlyGeneration.toLocaleString("pt-BR")} <small>kWh</small></strong><b>Estimativa para o sistema montado</b></div>
            <div><span>Economia mensal indicativa</span><strong>R$ {data.estimatedSavings.toLocaleString("pt-BR")}</strong><b>Até {coverage}% do consumo estimado</b></div>
          </div>
          <div className="performance-chart" aria-label="Distribuição ilustrativa da geração em sete dias; não é uma previsão meteorológica">
            <div className="chart-scale"><span>{maxDay} kWh</span><span>{Math.round(maxDay / 2)} kWh</span><span>0</span></div>
            <div className="analysis-bars">{week.map((value, index) => <div className="analysis-bar" key={index}><span style={{ height: `${Math.max(18, (value / maxDay) * 100)}%` }}/><small>{["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"][index]}</small></div>)}</div>
          </div>
          <p className="analysis-explanation">Distribuição ilustrativa em sete dias, não uma previsão meteorológica. Média diária estimada: {dailyAverage.toLocaleString("pt-BR",{maximumFractionDigits:1})} kWh.</p>
          <dl className="analysis-details"><div><dt>Imóvel escolhido</dt><dd>{data.property}</dd></div><div><dt>Conta do imóvel</dt><dd>R$ {data.bill.toLocaleString("pt-BR")}/mês</dd></div><div><dt>Consumo total estimado</dt><dd>{data.monthlyConsumption.toLocaleString("pt-BR")} kWh/mês</dd></div><div><dt>Recarga adicional</dt><dd>{data.vehicle?`${Math.round(data.vehicle.monthlyEnergy)} kWh/mês`:"Não incluída"}</dd></div><div><dt>Perda por sombra no modelo</dt><dd>{data.shadingLoss ?? 0}%</dd></div></dl>
          <p className="analysis-explanation">Referências do cálculo: módulos de 550 W, produção de 130 kWh/kWp por mês antes das sombras e tarifa de R$ 0,95/kWh. Economia indicativa considera 85% do valor compensável. O modelo 3D é ilustrativo; não representa o levantamento do seu telhado.</p>
          <footer className="performance-footer">
            <div><span>Configuração atual</span><strong>{data.panels} painéis · {data.installedPower.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp</strong></div>
            <button type="button" onClick={onContact}>Solicitar análise técnica <ArrowIcon/></button>
          </footer>
          <a className="analysis-direct" href={`https://wa.me/5584992315543?text=${encodeURIComponent(analysisMessage)}`} target="_blank" rel="noreferrer" onClick={()=>trackConversion('whatsapp_clicked','analysis')}>Prefiro enviar este resultado diretamente pelo WhatsApp</a>
        </div>
      </article>
  </div>;
}
