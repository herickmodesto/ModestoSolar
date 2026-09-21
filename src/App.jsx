import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import "./styles/global.css";
import "./styles/solar-map.css";
import GenerationAnalysis from "./components/GenerationAnalysis";
import DeferredSection from "./components/DeferredSection";
import { trackConversion } from "./lib/conversion-events";
import "./styles/conversion.css";

const SolarConfigurator = lazy(() => import("./components/SolarConfigurator"));
const ElectricVehicleSection = lazy(() => import("./components/ElectricVehicleSection"));

const PHONE = "5584992315543";
const INSTAGRAM_URL = "https://www.instagram.com/modesto_rn/";
const icons = {
  sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2 12h2M20 12h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/></>,
  chart:<><path d="M3 3v18h18"/><path d="m7 16 4-5 3 3 5-7"/></>,
  shield:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></>,
  home:<><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  building:<><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M8 6h2M14 6h2M8 10h2M14 10h2M8 14h2M14 14h2M10 22v-4h4v4"/></>,
  leaf:<><path d="M11 20A7 7 0 0 1 9.8 6C15.5 4 20 5 20 5c0 7-3.3 12-9 12"/><path d="M2 21c0-3 1.9-5.4 5.1-6.9C9.4 12.9 12.6 12 16 10"/></>,
  search:<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.4-4.4"/></>,
  pen:<><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
  tool:<><path d="M14.7 6.3a4 4 0 0 0-5-5l2.1 2.1-2.4 2.4-2.1-2.1a4 4 0 0 0 5 5l7.4 7.4a2.1 2.1 0 0 1-3 3l-7.4-7.4"/><path d="m5 13-3 3 3 3 3-3"/></>,
  monitor:<><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M6 12l3-3 3 2 4-5 2 2"/></>,
  check:<path d="m20 6-11 11-5-5"/>, arrow:<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  menu:<path d="M4 6h16M4 12h16M4 18h16"/>, close:<path d="m6 6 12 12M18 6 6 18"/>,
  whatsapp:<><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.2 8.1c.3-.6.6-.6 1-.6.3 0 .6 0 .8.5l.8 1.9c.1.3 0 .6-.2.8l-.6.7c.8 1.5 1.7 2.4 3.2 3.2l.7-.6c.2-.2.5-.3.8-.2l1.9.8c.5.2.5.5.5.8 0 .4 0 .7-.6 1-1 .5-3.1.1-5.4-2.2-2.4-2.3-2.7-4.4-2.2-5.4Z"/></>,
  bolt:<path d="m13 2-9 12h8l-1 8 9-12h-8z"/>,
};
function Icon({name,size=22}){return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>}

const hasElectricVehicle=data=>data.electricVehicle==="Já possuo"||data.electricVehicle==="Pretendo adquirir";
const chatQuestions=[
  {key:"name",text:"Para começar, como posso chamar você?",placeholder:"Digite seu nome",type:"text"},
  {key:"city",text:"Prazer! Em qual cidade será feita a instalação?",placeholder:"Ex.: Natal / RN",type:"text"},
  {key:"bill",text:"Qual é o valor médio da sua conta de energia?",placeholder:"Ex.: 600",type:"number",prefix:"R$"},
  {key:"segment",text:"Esse projeto é para qual tipo de imóvel?",options:["Residência","Empresa","Propriedade rural"]},
  {key:"ownership",text:"E o imóvel é próprio ou alugado?",options:["Próprio","Alugado","Ainda não sei"]},
  {key:"roofType",text:"Como é a cobertura onde os painéis poderão ser instalados?",options:["Telha cerâmica","Fibrocimento","Laje ou metálica","Ainda não sei"]},
  {key:"shade",text:"Você percebe sombras no telhado durante o dia?",options:["Não percebo sombras","Pouca sombra","Muita sombra","Ainda não sei"]},
  {key:"electricVehicle",text:"Você possui ou pretende adquirir um carro elétrico?",options:["Já possuo","Pretendo adquirir","Não"]},
  {key:"evProfile",text:"Como será o uso principal do carro elétrico?",options:["Uso particular","Motorista de aplicativo","Empresa ou frota"],when:hasElectricVehicle},
  {key:"evDailyKm",text:"Quantos quilômetros o carro percorre ou deverá percorrer por dia?",placeholder:"Ex.: 50",type:"number",suffix:"km",when:hasElectricVehicle},
  {key:"financing",text:"Você gostaria de avaliar financiamento para o projeto?",options:["Sim, quero financiar","Quero comparar opções","Não neste momento"]},
  {key:"timeline",text:"Quando você pretende realizar o projeto?",options:["O quanto antes","Nos próximos 3 meses","Ainda estou pesquisando"]},
];

function ChatAssistant({onClose, initialAnswers = {}, simulation, vehicle}){
  const [messages,setMessages]=useState([{from:"bot",text:"Olá! ☀️ Sou o assistente da Modesto. Vou reunir as informações iniciais do seu projeto solar em poucos minutos."},{from:"bot",text:chatQuestions[0].text}]);
  const [step,setStep]=useState(0),[input,setInput]=useState(""),[answers,setAnswers]=useState(initialAnswers),[typing,setTyping]=useState(false),[complete,setComplete]=useState(false);
  const chatEnd=useRef(null),replyTimer=useRef(null);
  useEffect(()=>{const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;chatEnd.current?.scrollIntoView({behavior:reducedMotion?"auto":"smooth",block:"nearest"})},[messages,typing]);
  useEffect(()=>{["assistente-saudacao.jpg","assistente-pensando.jpg","assistente-sucesso.jpg"].forEach(file=>{const asset=new Image();asset.src=`/images/${file}`;asset.decode?.().catch(()=>{})});return()=>{window.clearTimeout(replyTimer.current)}},[]);
  const createWhatsAppUrl=data=>{const message=["Olá, Modesto Energias Renováveis! Fiz a análise inicial pelo site.",`Nome: ${data.name||""}`,`Cidade: ${data.city||""}`,`Conta média: R$ ${data.bill||""}`,`Tipo de imóvel: ${data.segment||""}`,`Situação do imóvel: ${data.ownership||""}`,`Tipo de cobertura: ${data.roofType||""}`,`Sombreamento percebido: ${data.shade||""}`,`Carro elétrico: ${data.electricVehicle||""}`,hasElectricVehicle(data)?`Perfil do carro: ${data.evProfile||""}`:"",hasElectricVehicle(data)?`Percurso diário: ${data.evDailyKm||""} km`:"",`Interesse em financiamento: ${data.financing||""}`,`Prazo desejado: ${data.timeline||""}`,"Gostaria de receber uma análise de viabilidade."].filter(Boolean).join("\n");return `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`};
  const addAnswer=(rawValue)=>{
    const value=String(rawValue).trim();
    if(!value||typing||complete)return;
    if(chatQuestions[step].type==="number"&&Number(value)<=0)return;
    const question=chatQuestions[step];
    const display=[question.prefix,value,question.suffix].filter(Boolean).join(" ");
    const nextAnswers={...answers,[question.key]:value};
    setAnswers(nextAnswers);setMessages(list=>[...list,{from:"user",text:display}]);setInput("");setTyping(true);
    replyTimer.current=window.setTimeout(()=>{
      const next=chatQuestions.findIndex((item,index)=>index>step&&!nextAnswers[item.key]&&(!item.when||item.when(nextAnswers)));
      setTyping(false);
      if(next!==-1){setStep(next);setMessages(list=>[...list,{from:"bot",text:chatQuestions[next].text}]);}
      else{setComplete(true);trackConversion('contact_reviewed','contact');setMessages(list=>[...list,{from:"bot",text:`Tudo pronto, ${nextAnswers.name}. Confira suas respostas e envie quando quiser.`}]);}
    },900);
  };
  const submit=e=>{e.preventDefault();addAnswer(input)};
  const restart=()=>{window.clearTimeout(replyTimer.current);setMessages([{from:"bot",text:"Vamos começar uma nova simulação. Como posso chamar você?"}]);setStep(0);setInput("");setAnswers({});setTyping(false);setComplete(false)};
  const context = [simulation ? `Simulação: ${simulation.panels} painéis · ${simulation.installedPower.toFixed(2)} kWp · geração estimada de ${simulation.monthlyGeneration} kWh/mês. Conta usada no cálculo: R$ ${simulation.bill}.` : '', vehicle ? `Recarga simulada: ${vehicle.dailyDistance} km/dia · ${vehicle.workingDays} dias/mês · ${vehicle.consumption} kWh/100 km · wallbox ${vehicle.chargerPower} kW · ${Math.round(vehicle.monthlyEnergy)} kWh/mês adicionais.` : '', 'Alterações nas respostas devem ser consideradas na revisão técnica da simulação.'].filter(Boolean).join('\n');
  const whatsappUrl=`${createWhatsAppUrl(answers)}${encodeURIComponent('\n'+context)}`;
  const question=chatQuestions[step];
  const visibleQuestions=chatQuestions.filter(item=>!item.when||item.when(answers));
  const currentQuestionPosition=Math.max(0,visibleQuestions.findIndex(item=>item.key===question?.key));
  const progressSegments=5;
  const completedSegments=complete?progressSegments:Math.max(1,Math.ceil(((currentQuestionPosition+1)/visibleQuestions.length)*progressSegments));
  const mascotMood=complete?"success":typing?"thinking":step%2===0?"welcome":"encouraging";
  const mascotImage=complete?"/images/assistente-sucesso.jpg":typing?"/images/assistente-pensando.jpg":step%2===0?"/images/assistente-saudacao.jpg":"/images/assistente-sucesso.jpg";
  const mascotCaption=complete?"Tudo pronto!":typing?"Analisando sua resposta...":step===0?"Olá! Vamos começar?":"Muito bem! Continue assim.";
  return <div className={`solar-chat mascot-${mascotMood}`} aria-label="Assistente de análise solar">
    <div className="chat-interface">
    <div className="chat-header"><div className="chat-avatar"><img key={`header-${mascotMood}-${step}`} src={mascotImage} alt="Assistente virtual da Modesto"/><i/></div><span><b>Assistente Modesto</b><small><i/>{mascotCaption}</small></span><div className="chat-progress" aria-label={`Pergunta ${currentQuestionPosition+1} de ${visibleQuestions.length}`}>{Array.from({length:progressSegments},(_,i)=><i className={i<completedSegments?"done":""} key={i}/>)}</div>{onClose&&<button className="chat-close" type="button" onClick={onClose} aria-label="Fechar atendimento"><Icon name="close" size={18}/></button>}</div>
    {!complete&&<div className="chat-messages" role="log" aria-live="polite">{messages.map((message,i)=><div className={`chat-row ${message.from}`} key={`${message.text}-${i}`}>{message.from==="bot"&&<span className="message-avatar" aria-hidden="true"><img key={`message-${mascotMood}-${step}-${i}`} src={mascotImage} alt=""/></span>}<div className="chat-bubble">{message.text}</div></div>)}{typing&&<div className="chat-row bot"><span className="message-avatar thinking-avatar" aria-hidden="true"><img src="/images/assistente-pensando.jpg" alt=""/></span><div className="typing-dots" aria-label="Assistente digitando"><i/><i/><i/></div></div>}<div ref={chatEnd}/></div>}
    {!complete&&question.options&&<div className="quick-replies">{question.options.map(option=><button type="button" key={option} onClick={()=>addAnswer(option)} disabled={typing}>{option}</button>)}</div>}
    {!complete&&!question.options&&<form className="chat-input" onSubmit={submit}><div>{question.prefix&&<span>{question.prefix}</span>}<input aria-label={question.placeholder} inputMode={question.type==="number"?"numeric":"text"} placeholder={question.placeholder} value={input} onChange={e=>setInput(question.type==="number"?e.target.value.replace(/\D/g,""):e.target.value)}/></div><button type="submit" disabled={!input.trim()||typing} aria-label="Enviar resposta"><Icon name="arrow" size={19}/></button></form>}
    {complete&&<form className="contact-review" onSubmit={event=>{event.preventDefault();trackConversion('whatsapp_clicked','contact_review');window.location.assign(whatsappUrl)}}><h3>Confira antes de enviar</h3><p>Você pode corrigir as respostas abaixo. O envio abre uma mensagem preenchida no WhatsApp.</p>{simulation&&<p className="review-context">Sua montagem está incluída: {simulation.panels} painéis · {simulation.monthlyGeneration} kWh/mês estimados.</p>}{visibleQuestions.map(item=><label key={item.key}><span>{item.text}</span>{item.options?<select value={answers[item.key]||''} required onChange={event=>setAnswers(current=>({...current,[item.key]:event.target.value}))}><option value="" disabled>Selecione</option>{[...new Set([...item.options, ...(answers[item.key]?[answers[item.key]]:[])])].map(option=><option key={option}>{option}</option>)}</select>:<input required type={item.type==='number'?'number':'text'} min={item.type==='number'?1:undefined} maxLength={120} value={answers[item.key]||''} onChange={event=>setAnswers(current=>({...current,[item.key]:event.target.value}))}/>}</label>)}<button className="btn btn-primary full" type="submit">Enviar minha simulação pelo WhatsApp <Icon name="arrow" size={18}/></button><button className="review-restart" type="button" onClick={restart}>Recomeçar perguntas</button></form>}
    <div className="chat-privacy"><Icon name="shield" size={13}/> As respostas serão compartilhadas com a Modesto ao enviar pelo WhatsApp.</div></div>
  </div>
}

const fallbackNewsItems=[
  {image:"/images/noticia-setor-solar.jpeg",source:"Canal Solar",isFallback:true,title:"Notícias e análises do setor solar no Canal Solar",url:"https://canalsolar.com.br/"},
  {image:"/images/noticia-conta-de-luz.jpeg",source:"ANEEL",isFallback:true,title:"Tarifas e bandeiras de energia: consulte a ANEEL",url:"https://www.gov.br/aneel/pt-br/assuntos/noticias"},
  {image:"/images/noticia-data-centers.jpeg",source:"ABSOLAR",isFallback:true,title:"Acompanhe o setor solar com a ABSOLAR",url:"https://www.absolar.org.br/noticias/"},
  {image:"/images/noticia-agrivoltaico.jpeg",source:"pv magazine Brasil",isFallback:true,title:"Tecnologia e energia solar na pv magazine Brasil",url:"https://www.pv-magazine-brasil.com/"},
];
const faqs=[
  ["Como funciona o projeto do início até a geração?","A Modesto acompanha todo o processo. A simulação do site é uma estimativa inicial; antes da proposta definitiva, validamos tecnicamente o imóvel e o consumo.",[
    ["Diagnóstico","Analisamos a conta de energia, o perfil de consumo, o endereço e as características do imóvel."],
    ["Estudo solar","Avaliamos irradiação, orientação, inclinação e sombreamento causado por árvores, muros, caixas-d’água e construções próximas."],
    ["Dimensionamento","Definimos quantidade de painéis, potência do inversor, geração esperada e projeção de economia."],
    ["Proposta e financiamento","Apresentamos o projeto e auxiliamos na busca de opções de pagamento ou financiamento."],
    ["Projeto e homologação","Preparamos a documentação técnica e acompanhamos o processo junto à distribuidora de energia."],
    ["Instalação","Nossa equipe instala estruturas, módulos, inversor e proteções, realizando os testes de segurança e funcionamento."],
    ["Ativação e acompanhamento","Após a liberação, orientamos o cliente e acompanhamos o desempenho do sistema no pós-venda."],
  ]],
  ["Vocês fazem análise de sombreamento?","Sim. A análise identifica os horários e as áreas do telhado afetadas por sombras ao longo do dia. Com essas informações, reposicionamos módulos quando necessário e estimamos as perdas antes de fechar o dimensionamento. A visualização do site é preliminar e a validação técnica do imóvel confirma o projeto final."],
  ["É possível financiar o sistema solar?","Sim. Ajudamos o cliente a avaliar alternativas de financiamento e a organizar as informações necessárias para a proposta. A aprovação, as taxas, os prazos e as condições são definidos pela instituição financeira após a análise de crédito."],
  ["Vocês cuidam da instalação e da homologação?","Sim. A Modesto cuida do projeto elétrico, documentação, solicitação de acesso, instalação dos equipamentos, proteções, testes e acompanhamento da homologação junto à distribuidora. O cliente recebe orientação em cada etapa."],
  ["Quanto posso economizar com energia solar?","A economia depende do consumo, da tarifa, da irradiação, do sombreamento e das condições do imóvel. Um sistema corretamente dimensionado pode compensar grande parte da energia consumida, mas apresentamos a projeção somente depois de analisar esses fatores."],
  ["O que acontece depois da instalação?","Após a ativação, orientamos o cliente sobre o funcionamento e o acompanhamento da geração. A Modesto continua disponível para verificar o desempenho do sistema e prestar suporte no pós-venda."],
];
const metropolitanCities=[
  ["Natal",-5.7945,-35.211,"Capital e principal centro de atendimento da região."],
  ["Parnamirim",-5.9156,-35.2628,"Município integrado à área urbana de Natal."],
  ["São Gonçalo do Amarante",-5.7927,-35.3297,"Área estratégica para projetos residenciais e comerciais."],
  ["Macaíba",-5.858,-35.353,"Município da porção oeste da região metropolitana."],
  ["Extremoz",-5.7056,-35.3072,"Área litorânea com forte incidência solar."],
  ["Ceará-Mirim",-5.6433,-35.4256,"Município ao norte da região metropolitana."],
  ["Nísia Floresta",-6.0911,-35.2086,"Área ao sul de Natal atendida pela equipe Modesto."],
  ["São José de Mipibu",-6.0778,-35.2378,"Município integrado ao eixo sul metropolitano."],
];

const weatherDescription=code=>{
  if(code===0)return ["Céu limpo","sun","sunny"];
  if(code<=2)return ["Parcialmente nublado","partly","partly"];
  if(code===3)return ["Céu encoberto","cloud","cloudy"];
  if(code===45||code===48)return ["Névoa","fog","cloudy"];
  if(code>=95)return ["Possibilidade de trovoada","storm","storm"];
  if(code>=51&&code<=82)return ["Possibilidade de chuva","rain","rain"];
  return ["Tempo variável","partly","partly"];
};
const solarOutlook=({isDay=true,radiation=0,cloudCover=0,weatherCode=0})=>{
  if(!isDay)return ["Sem geração neste horário","A geração é retomada naturalmente após o nascer do sol.","night"];
  if(weatherCode>=51)return ["Geração reduzida","A chuva e as nuvens podem diminuir temporariamente a produção.","low"];
  if(cloudCover>=70)return ["Produção variável","A cobertura de nuvens pode provocar oscilações ao longo do período.","medium"];
  if(radiation>=650)return ["Alta disponibilidade solar","Condição favorável para uma produção elevada neste período.","high"];
  if(radiation>=250)return ["Condição favorável","Há boa disponibilidade solar para geração de energia.","good"];
  return ["Baixa irradiância agora","A produção pode aumentar conforme a abertura do céu e o avanço do dia.","medium"];
};
const weekdayLabel=date=>new Intl.DateTimeFormat("pt-BR",{weekday:"short",timeZone:"America/Fortaleza"}).format(new Date(`${date}T12:00:00-03:00`)).replace(".","").toUpperCase();
const mapWeatherSelection=(data,index)=>{
  const isToday=index===0,code=isToday?data.current.weather_code:data.daily.weather_code[index];
  const radiation=isToday?data.current.shortwave_radiation:data.daily.shortwave_radiation_sum[index];
  const isDay=isToday?Boolean(data.current.is_day):true;
  const radiationFactor=isToday?Math.min(1,Math.max(.08,(radiation||0)/800)):Math.min(1,Math.max(.15,(radiation||0)/24));
  const weatherFactor=!isDay ? .08 : code>=95 ? .22 : code>=51 ? .35 : code===3 ? .52 : code===2 ? .72 : 1;
  const regions=(data.regionalForecast||[]).map(location=>{
    const localCode=isToday?location.current.weather_code:location.daily.weather_code[index];
    const localRadiation=isToday?location.current.shortwave_radiation:location.daily.shortwave_radiation_sum[index];
    const localIsDay=isToday?Boolean(location.current.is_day):true;
    const localRadiationFactor=isToday?Math.min(1,Math.max(.08,(localRadiation||0)/800)):Math.min(1,Math.max(.15,(localRadiation||0)/24));
    const localWeatherFactor=!localIsDay ? .08 : localCode>=95 ? .22 : localCode>=51 ? .35 : localCode===3 ? .52 : localCode===2 ? .72 : 1;
    return {code:localCode,radiation:localRadiation,factor:Math.min(localRadiationFactor,localWeatherFactor),rainy:localCode>=51,storm:localCode>=95,tone:weatherDescription(localCode)[2]};
  });
  return {index,code,radiation,factor:Math.min(radiationFactor,weatherFactor),rainy:code>=51,storm:code>=95,tone:weatherDescription(code)[2],label:isToday?"Hoje":weekdayLabel(data.daily.time[index]),regions};
};
const HEAT_BOUNDS={north:-5.53,south:-6.18,east:-35.08,west:-35.55};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const mixRgb=(from,to,amount)=>from.map((channel,index)=>Math.round(channel+(to[index]-channel)*amount));
const radiationColor=(factor,rainRatio,cloudRatio)=>{
  const normalized=clamp((factor-.08)/.95,0,1);
  const warm=normalized<.55?mixRgb([255,229,132],[255,170,48],normalized/.55):mixRgb([255,170,48],[235,76,59],(normalized-.55)/.45);
  const rainy=mixRgb([190,222,235],[48,112,158],normalized);
  const cloudy=mixRgb([210,222,228],[91,121,136],normalized);
  return mixRgb(mixRgb(warm,cloudy,clamp(cloudRatio-rainRatio,0,.72)),rainy,clamp(rainRatio*1.15,0,.9));
};
const createRadiationRaster=(weatherSelection,solarAtlas)=>{
  const canvas=document.createElement("canvas");
  canvas.width=420;canvas.height=580;
  const context=canvas.getContext("2d");
  const image=context.createImageData(canvas.width,canvas.height);
  const longitudeScale=Math.cos(-5.85*Math.PI/180);
  const points=metropolitanCities.map(([,lat,lng],cityIndex)=>{
    const local=weatherSelection?.regions?.[cityIndex]||weatherSelection;
    const annualGhi=solarAtlas?.[cityIndex]?.ghi;
    const annualFactor=Number.isFinite(annualGhi)?clamp(annualGhi/2180,.86,1.08):1;
    return {lat,lng,factor:clamp((local?.factor??.82)*annualFactor,.08,1.08),rain:local?.rainy||local?.storm?1:0,cloud:local?.tone==="cloudy"?.72:0};
  });
  for(let y=0;y<canvas.height;y+=1){
    const lat=HEAT_BOUNDS.north-(y/(canvas.height-1))*(HEAT_BOUNDS.north-HEAT_BOUNDS.south);
    for(let x=0;x<canvas.width;x+=1){
      const lng=HEAT_BOUNDS.west+(x/(canvas.width-1))*(HEAT_BOUNDS.east-HEAT_BOUNDS.west);
      let weightTotal=0,factorTotal=0,rainTotal=0,cloudTotal=0,nearest=Infinity;
      points.forEach(point=>{
        const dy=lat-point.lat,dx=(lng-point.lng)*longitudeScale;
        const distanceSquared=dx*dx+dy*dy;
        nearest=Math.min(nearest,Math.sqrt(distanceSquared));
        const weight=1/Math.pow(distanceSquared+.00032,1.3);
        weightTotal+=weight;factorTotal+=point.factor*weight;rainTotal+=point.rain*weight;cloudTotal+=point.cloud*weight;
      });
      const coverage=clamp((.235-nearest)/.105,0,1);
      const edgeFade=Math.min(clamp(x/28,0,1),clamp((canvas.width-1-x)/28,0,1),clamp(y/28,0,1),clamp((canvas.height-1-y)/28,0,1));
      const alpha=Math.round(coverage*edgeFade*145);
      const color=radiationColor(factorTotal/weightTotal,rainTotal/weightTotal,cloudTotal/weightTotal);
      const offset=(y*canvas.width+x)*4;
      image.data[offset]=color[0];image.data[offset+1]=color[1];image.data[offset+2]=color[2];image.data[offset+3]=alpha;
    }
  }
  context.putImageData(image,0,0);
  return canvas.toDataURL("image/png");
};

function WeatherIcon({type,size=22}){
  if(type==="sun")return <svg className="weather-svg weather-sun-svg" width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true"><path d="M512 704a192 192 0 1 0 0-384 192 192 0 0 0 0 384zm0 64a256 256 0 1 1 0-512 256 256 0 0 1 0 512zm0-704a32 32 0 0 1 32 32v64a32 32 0 0 1-64 0V96a32 32 0 0 1 32-32zm0 768a32 32 0 0 1 32 32v64a32 32 0 1 1-64 0v-64a32 32 0 0 1 32-32zM195.2 195.2a32 32 0 0 1 45.248 0l45.248 45.248a32 32 0 1 1-45.248 45.248L195.2 240.448a32 32 0 0 1 0-45.248zm543.104 543.104a32 32 0 0 1 45.248 0l45.248 45.248a32 32 0 0 1-45.248 45.248l-45.248-45.248a32 32 0 0 1 0-45.248zM64 512a32 32 0 0 1 32-32h64a32 32 0 0 1 0 64H96a32 32 0 0 1-32-32zm768 0a32 32 0 0 1 32-32h64a32 32 0 1 1 0 64h-64a32 32 0 0 1-32-32zM195.2 828.8a32 32 0 0 1 0-45.248l45.248-45.248a32 32 0 0 1 45.248 45.248L240.448 828.8a32 32 0 0 1-45.248 0zm543.104-543.104a32 32 0 0 1 0-45.248l45.248-45.248a32 32 0 0 1 0-45.248l45.248-45.248a32 32 0 0 1 45.248 45.248l-45.248 45.248a32 32 0 0 1-45.248 0z"/></svg>;
  if(type==="partly")return <svg className="weather-svg" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 8a5 5 0 0 1 9.7-1.7"/><path d="M14.5 5.5 16 4m-5-1V1m7.5 8H21"/><path d="M6.5 19h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.7A3.2 3.2 0 0 0 6.5 19Z"/></svg>;
  if(type==="rain")return <svg className="weather-svg" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 15h10a4 4 0 0 0 .4-8A6 6 0 0 0 5.4 8.7 3.2 3.2 0 0 0 6.5 15Z"/><path d="m8 18-1 2m5-2-1 2m5-2-1 2"/></svg>;
  if(type==="storm")return <svg className="weather-svg" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 14h10a4 4 0 0 0 .4-8A6 6 0 0 0 5.4 7.7 3.2 3.2 0 0 0 6.5 14Z"/><path d="m12 15-2 4h3l-1 3"/></svg>;
  if(type==="fog")return <svg className="weather-svg" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 13h10a4 4 0 0 0 .4-8A6 6 0 0 0 5.4 6.7 3.2 3.2 0 0 0 6.5 13Z"/><path d="M5 17h14M7 20h10"/></svg>;
  return <svg className="weather-svg" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 5.4 11.7 3.2 3.2 0 0 0 6.5 18Z"/></svg>;
}

function SolarWeatherCard({onForecastChange}){
  const [weather,setWeather]=useState(null);
  const [weatherState,setWeatherState]=useState("loading");
  const [selectedDay,setSelectedDay]=useState(0);
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{
    const controller=new AbortController();
    const loadWeather=async()=>{
      try{
        const params=new URLSearchParams({latitude:"-5.7945",longitude:"-35.211",timezone:"America/Fortaleza",forecast_days:"4",current:"temperature_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,shortwave_radiation",daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunshine_duration,shortwave_radiation_sum"});
        const regionalParams=new URLSearchParams({latitude:metropolitanCities.map(city=>city[1]).join(","),longitude:metropolitanCities.map(city=>city[2]).join(","),timezone:"America/Fortaleza",forecast_days:"4",current:"is_day,weather_code,shortwave_radiation",daily:"weather_code,shortwave_radiation_sum"});
        const [response,regionalResponse]=await Promise.all([fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{signal:controller.signal}),fetch(`https://api.open-meteo.com/v1/forecast?${regionalParams}`,{signal:controller.signal})]);
        if(!response.ok||!regionalResponse.ok)throw new Error("weather-unavailable");
        const [data,regionalData]=await Promise.all([response.json(),regionalResponse.json()]);
        if(!data.current||!data.daily?.time?.length)throw new Error("weather-invalid");
        const combined={...data,regionalForecast:Array.isArray(regionalData)?regionalData:[regionalData]};
        setWeather(combined);setWeatherState("ready");onForecastChange?.(mapWeatherSelection(combined,0));
      }catch(error){if(error.name!=="AbortError")setWeatherState("error")}
    };
    loadWeather();const refresh=setInterval(loadWeather,15*60*1000);
    return()=>{controller.abort();clearInterval(refresh)};
  },[onForecastChange]);
  if(weatherState==="loading")return <div className="solar-weather-card weather-placeholder" aria-live="polite"><span className="weather-loader"/><strong>Consultando o clima de Natal...</strong></div>;
  if(weatherState==="error")return <div className="solar-weather-card weather-placeholder" role="status"><WeatherIcon type="cloud" size={30}/><strong>Clima indisponível agora</strong><small>O mapa continua funcionando normalmente.</small></div>;
  const current=weather.current,daily=weather.daily;
  const code=selectedDay===0?current.weather_code:daily.weather_code[selectedDay];
  const [condition,weatherIcon,tone]=weatherDescription(code);
  const isToday=selectedDay===0;
  const radiation=isToday?current.shortwave_radiation:Math.round((daily.shortwave_radiation_sum[selectedDay]||0)*10)/10;
  const [impactTitle,impactText,impactTone]=solarOutlook({isDay:isToday?Boolean(current.is_day):true,radiation:isToday?radiation:radiation*45,cloudCover:isToday?current.cloud_cover:(code===3?85:code>=51?75:30),weatherCode:code});
  const temperature=Math.round(isToday?current.temperature_2m:daily.temperature_2m_max[selectedDay]);
  const min=Math.round(daily.temperature_2m_min[selectedDay]),max=Math.round(daily.temperature_2m_max[selectedDay]);
  const clock=now.toLocaleTimeString("pt-BR",{timeZone:"America/Fortaleza",hour:"2-digit",minute:"2-digit"});
  const dateLabel=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Fortaleza",weekday:"short",day:"2-digit",month:"short"}).format(now).replaceAll(".","");
  return <article className={`solar-weather-card weather-${tone}`} aria-label="Clima e perspectiva de geração solar em Natal">
    <div className="weather-main"><div className="weather-background-design"><div className="weather-orb orb-one"/><div className="weather-orb orb-two"/><div className="weather-orb orb-three"/></div><div className="weather-current"><span className="weather-condition"><WeatherIcon type={weatherIcon}/>{condition}</span><strong className="weather-temperature">{temperature}°</strong><span>{max}° / {min}°</span></div><div className="weather-place"><strong>{clock}</strong><span>{dateLabel}</span><b>Natal, RN</b></div></div>
    <div className="weather-days" aria-label="Previsão para os próximos dias">{daily.time.slice(0,4).map((date,index)=>{const [label,icon,dayTone]=weatherDescription(daily.weather_code[index]);return <button key={date} className={`${selectedDay===index?"active":""} day-${dayTone}`} type="button" onClick={()=>{setSelectedDay(index);onForecastChange?.(mapWeatherSelection(weather,index))}} aria-pressed={selectedDay===index} title={label}><span>{index===0?"HOJE":weekdayLabel(date)}</span><WeatherIcon type={icon} size={17}/></button>})}</div>
    <div className={`solar-impact impact-${impactTone}`}><span className="impact-dot"/><div><strong>{impactTitle}</strong><p>{impactText}</p><small>{isToday?`${Math.round(radiation)} W/m² agora · ${Math.round(current.cloud_cover)}% de nuvens`:`${radiation} MJ/m² previstos · ${daily.precipitation_probability_max[selectedDay]||0}% de chance de chuva`}</small></div></div>
    <footer>Previsão meteorológica atualizada automaticamente · Fonte: Open-Meteo</footer>
  </article>;
}

function MetropolitanMap({weatherSelection,solarAtlas}){
  const mapElement=useRef(null);
  const mapInstance=useRef(null);
  const heatOverlay=useRef(null);
  const cityOverlays=useRef([]);
  const heatVisibleRef=useRef(true);
  const [mapState,setMapState]=useState(()=>import.meta.env.VITE_GOOGLE_MAPS_API_KEY?"loading":"missing-key");
  const [mapMessage,setMapMessage]=useState("");
  const [heatVisible,setHeatVisible]=useState(true);
  const [selectedCity,setSelectedCity]=useState(null);
  useEffect(()=>{
    const apiKey=import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if(!apiKey)return;
    const initialize=()=>{
      if(mapInstance.current)return;
      if(!mapElement.current||!window.google?.maps){setMapState("error");setMapMessage("Não foi possível carregar o Google Maps.");return}
      const map=new window.google.maps.Map(mapElement.current,{center:{lat:-5.82,lng:-35.28},zoom:10,mapTypeControl:true,streetViewControl:false,fullscreenControl:true,gestureHandling:"cooperative",mapTypeControlOptions:{mapTypeIds:["roadmap","satellite"]},styles:[{featureType:"poi.business",stylers:[{visibility:"off"}]},{featureType:"transit",stylers:[{visibility:"off"}]}]});
      mapInstance.current=map;
      const bounds=new window.google.maps.LatLngBounds();
      metropolitanCities.forEach(([name,lat,lng],cityIndex)=>{
        const position={lat,lng};
        bounds.extend(position);
        const overlay=new window.google.maps.OverlayView();
        overlay.onAdd=function(){
          const button=document.createElement("button");
          const label=document.createElement("span");
          const sign=document.createElement("span");
          button.type="button";button.className="map-city";button.setAttribute("aria-label",`Ver informações solares de ${name}`);
          label.className="map-city__label";
          sign.className="map-city__sign";sign.textContent=name;
          label.append(sign);button.append(label);button.addEventListener("click",()=>setSelectedCity(cityIndex));
          this.element=button;this.getPanes().overlayMouseTarget.appendChild(button);
        };
        overlay.draw=function(){
          if(!this.element)return;
          const point=this.getProjection().fromLatLngToDivPixel(new window.google.maps.LatLng(position));
          if(point){
            const mapWidth=map.getDiv().clientWidth;
            this.element.classList.toggle("is-near-left",point.x<150);
            this.element.classList.toggle("is-near-right",point.x>mapWidth-150);
            this.element.style.transform=`translate(${Math.round(point.x)}px,${Math.round(point.y)}px) translate(-50%,-50%)`;
          }
        };
        overlay.onRemove=function(){this.element?.remove();this.element=null};
        overlay.setMap(map);cityOverlays.current.push(overlay);
      });
      map.fitBounds(bounds,{top:45,right:45,bottom:45,left:45});
      setMapState("ready");
    };
    const cleanup=()=>{heatOverlay.current?.setMap(null);heatOverlay.current=null;cityOverlays.current.forEach(overlay=>overlay.setMap(null));cityOverlays.current=[];mapInstance.current=null};
    if(window.google?.maps){initialize();return cleanup}
    const existingScript=document.querySelector('script[data-google-maps="true"]');
    const handleError=()=>{setMapState("error");setMapMessage("O Google Maps não respondeu. Verifique a chave e a API ativada no Google Cloud.")};
    if(existingScript){existingScript.addEventListener("load",initialize);existingScript.addEventListener("error",handleError);return()=>{existingScript.removeEventListener("load",initialize);existingScript.removeEventListener("error",handleError);cleanup()}}
    const script=document.createElement("script");
    script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async=true;script.defer=true;script.dataset.googleMaps="true";
    script.addEventListener("load",initialize);script.addEventListener("error",handleError);
    document.head.appendChild(script);
    return()=>{script.removeEventListener("load",initialize);script.removeEventListener("error",handleError);cleanup()};
  },[]);
  useEffect(()=>{heatVisibleRef.current=heatVisible},[heatVisible]);
  useEffect(()=>{
    if(mapState!=="ready"||!mapInstance.current)return;
    const raster=createRadiationRaster(weatherSelection,solarAtlas);
    heatOverlay.current?.setMap(null);
    heatOverlay.current=new window.google.maps.GroundOverlay(raster,HEAT_BOUNDS,{clickable:false,opacity:1,map:heatVisibleRef.current?mapInstance.current:null});
  },[weatherSelection,solarAtlas,mapState]);
  useEffect(()=>{if(mapState!=="ready"||!heatOverlay.current)return;heatOverlay.current.setMap(heatVisible?mapInstance.current:null)},[heatVisible,mapState]);
  useEffect(()=>{cityOverlays.current.forEach((overlay,index)=>overlay.element?.classList.toggle("is-selected",index===selectedCity))},[selectedCity,mapState]);
  const selected=selectedCity===null?null:{city:metropolitanCities[selectedCity],atlas:solarAtlas?.[selectedCity],weather:weatherSelection?.regions?.[selectedCity]||weatherSelection};
  return <div className={`metropolitan-map-wrap map-weather-${weatherSelection?.tone||"sunny"}`}><div ref={mapElement} className={`metropolitan-map ${mapState!=="ready"?"is-loading":""}`} aria-label="Mapa do Google Maps com camada interpolada de radiação solar na Região Metropolitana de Natal" role="application"/><div className="map-controls"><label className="cl-checkbox" htmlFor="solar-heat-layer"><input type="checkbox" id="solar-heat-layer" checked={heatVisible} onChange={e=>setHeatVisible(e.target.checked)} disabled={mapState!=="ready"}/><span>Exibir mapa de calor</span></label><div className={`heat-legend ${heatVisible?"":"is-hidden"}`} aria-hidden={!heatVisible}><span>{weatherSelection?.label?`Radiação · ${weatherSelection.label}`:"Potencial"}</span><i/><small>Menor</small><small>Maior</small></div><small className={`heat-source-status ${solarAtlas?.length?"is-ready":""}`}><i/>{solarAtlas?.length?"Base GHI anual carregada":"Carregando base solar..."}</small></div>{selected&&<aside className="map-city-card" aria-live="polite"><button type="button" className="map-city-card__close" onClick={()=>setSelectedCity(null)} aria-label="Fechar informações"><Icon name="close" size={16}/></button><span className="map-city-card__eyebrow">CIDADE SELECIONADA</span><h3>{selected.city[0]}</h3><p>{selected.city[3]}</p><div className="map-city-metrics"><span><small>GHI médio anual</small><strong>{Number.isFinite(selected.atlas?.ghi)?Math.round(selected.atlas.ghi).toLocaleString("pt-BR"):"—"}</strong><b>kWh/m²/ano</b></span><span><small>Radiação · {weatherSelection?.label||"agora"}</small><strong>{Number.isFinite(selected.weather?.radiation)?Math.round(selected.weather.radiation).toLocaleString("pt-BR"):"—"}</strong><b>{weatherSelection?.index===0?"W/m²":"MJ/m²"}</b></span></div><footer>Global Solar Atlas · Open-Meteo</footer></aside>}{mapState==="loading"&&<div className="map-status">Carregando mapa...</div>}{mapState==="missing-key"&&<div className="map-status map-status-error"><strong>Mapa pronto para configurar</strong><span>Adicione sua chave em <code>VITE_GOOGLE_MAPS_API_KEY</code> para publicar o mapa interativo.</span></div>}{mapState==="error"&&<div className="map-status map-status-error"><strong>Não foi possível carregar o mapa</strong><span>{mapMessage}</span></div>}</div>;
}
function Logo(){return <a className="brand" href="#inicio" aria-label="Modesto Energias Renováveis"><img className="brand-logo" width="130" height="90" src="/images/modesto-logo-header.png" alt="Modesto Energias Renováveis"/></a>}
function SolarPanelModel(){
  const [active,setActive]=useState(false),[failed,setFailed]=useState(false);
  const open=()=>{setFailed(false);import("@google/model-viewer").then(()=>setActive(true)).catch(()=>setFailed(true))};
  return <div className="hero-model-stage" aria-label="Visualização de painéis solares">
    {active?<model-viewer src="/models/solar-panels.glb" poster="/images/solar-panel-preview.svg" alt="Modelo 3D interativo de painéis solares" camera-controls="" interaction-prompt="none" shadow-intensity="1" exposure="1.05" environment-image="neutral" camera-orbit="35deg 68deg 105%" min-camera-orbit="auto 35deg 105%" max-camera-orbit="auto 85deg 105%" field-of-view="28deg" disable-pan="" disable-zoom="" onError={()=>{setActive(false);setFailed(true)}}/>:<button className="hero-model-preview" type="button" onClick={open}><img src="/images/solar-panel-preview.svg" alt="Prévia ilustrativa de dois painéis solares" width="600" height="450"/><span>{failed?"Tentar abrir o modelo 3D":"Explorar painel em 3D"} <Icon name="arrow" size={18}/></span></button>}
    {active&&<span className="hero-model-hint">Arraste para explorar o modelo</span>}
  </div>;
}

export default function App(){
  const [menu,setMenu]=useState(false),[faq,setFaq]=useState(0),[chatOpen,setChatOpen]=useState(false);
  const [solarSimulation,setSolarSimulation]=useState({property:"Casa térrea",propertyType:"terrea",bill:600,panels:9,recommendedPanels:9,installedPower:4.95,monthlyGeneration:644,estimatedSavings:510,monthlyConsumption:632,solarAccess:100,shadingLoss:0,affectedPanels:0});
  const [analysisVisible,setAnalysisVisible]=useState(false);
  const [solarForecast,setSolarForecast]=useState(null);
  const [hasSimulation,setHasSimulation]=useState(false);
  const [vehicle,setVehicle]=useState(null);
  const [mapActive,setMapActive]=useState(false);
  const [newsActive,setNewsActive]=useState(false);
  const openContact=useCallback(()=>{setAnalysisVisible(false);setChatOpen(true);trackConversion('contact_started','page')},[]);
  const includeVehicle=useCallback(data=>{setVehicle(data);setHasSimulation(true);trackConversion('ev_included','vehicle')},[]);
  const removeVehicle=useCallback(()=>setVehicle(null),[]);
  const updateVehicle=useCallback(data=>setVehicle(current=>current?data:null),[]);
  const markSimulation=useCallback(()=>{setHasSimulation(true);trackConversion('simulation_started','residential')},[]);
  const [solarAtlas,setSolarAtlas]=useState(null);
  const [newsItems,setNewsItems]=useState(fallbackNewsItems);
  const chatDialog=useRef(null),lastFocused=useRef(null);
  const updateSolarSimulation=useCallback(data=>setSolarSimulation(data),[]);
  const hideGenerationAnalysis=useCallback(()=>setAnalysisVisible(false),[]);
  const showGenerationAnalysis=useCallback(()=>{setHasSimulation(true);setAnalysisVisible(true);trackConversion("simulation_completed","residential")},[]);
  useEffect(()=>{
    const visible=new Set();
    const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>entry.isIntersecting?visible.add(entry.target):visible.delete(entry.target));document.body.classList.toggle('simulation-in-view',visible.size>0)},{rootMargin:'-90px 0px -70px 0px'});
    ['simulador','mobilidade'].forEach(id=>{const section=document.getElementById(id);if(section)observer.observe(section)});
    return()=>{observer.disconnect();document.body.classList.remove('simulation-in-view')};
  },[]);
  useEffect(()=>{const f=()=>document.body.classList.toggle("scrolled",scrollY>20);f();addEventListener("scroll",f,{passive:true});return()=>removeEventListener("scroll",f)},[]);
  useEffect(()=>{
    const controller=new AbortController();
    if(!mapActive)return;
    Promise.all(metropolitanCities.map(async([name,lat,lng])=>{const response=await fetch(`https://api.globalsolaratlas.info/data/lta?loc=${lat},${lng}`,{signal:controller.signal});if(!response.ok)throw new Error("solar-atlas-unavailable");const result=await response.json();return {name,ghi:result.annual?.data?.GHI,pvout:result.annual?.data?.PVOUT_csi,updated:result.annual?.metadata?.layers?.GHI?.updated}})).then(points=>{if(points.every(point=>Number.isFinite(point.ghi)))setSolarAtlas(points)}).catch(error=>{if(error.name!=="AbortError")setSolarAtlas(null)});
    return()=>controller.abort();
  },[mapActive]);
  useEffect(()=>{
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setNewsActive(true);observer.disconnect()}},{rootMargin:"300px"});
    const target=document.getElementById("solucoes");if(target)observer.observe(target);
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!newsActive)return;
    const controller=new AbortController();
    fetch("/api/news",{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error("news-unavailable");return response.json()}).then(data=>{if(Array.isArray(data.news)&&data.news.length)setNewsItems(data.news)}).catch(()=>{});
    return()=>controller.abort();
  },[newsActive]);
  useEffect(()=>{document.body.classList.toggle("chat-open",chatOpen);if(!chatOpen)return()=>document.body.classList.remove("chat-open");lastFocused.current=document.activeElement;requestAnimationFrame(()=>chatDialog.current?.focus());const handleKeys=e=>{if(e.key==="Escape"){setChatOpen(false);return}if(e.key!=="Tab"||!chatDialog.current)return;const items=[...chatDialog.current.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')];if(!items.length){e.preventDefault();return}const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}};addEventListener("keydown",handleKeys);return()=>{document.body.classList.remove("chat-open");removeEventListener("keydown",handleKeys);lastFocused.current?.focus?.()}},[chatOpen]);
  return <div className="site-shell"><a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <header className="navbar" inert={chatOpen?true:undefined} aria-hidden={chatOpen}><div className="container nav-inner"><Logo/><nav id="main-navigation" className={`nav-links ${menu?"open":""}`} aria-label="Navegação principal">{[["simulador","Energia solar"],["mobilidade","Carro elétrico"],["mapa","Mapa solar"],["faq","Dúvidas"]].map(x=><a key={x[0]} href={`#${x[0]}`} onClick={()=>setMenu(false)}>{x[1]}</a>)}<a className="btn btn-small" href="#simulador" onClick={()=>setMenu(false)}>Simulação grátis</a></nav><button className="menu-button" onClick={()=>setMenu(!menu)} aria-label={menu?"Fechar menu":"Abrir menu"} aria-expanded={menu} aria-controls="main-navigation"><Icon name={menu?"close":"menu"}/></button></div></header>
    <main id="conteudo" inert={chatOpen||analysisVisible?true:undefined} aria-hidden={chatOpen||analysisVisible}>
      <section className="hero" id="inicio"><div className="hero-backdrop"/><div className="container hero-content"><div className="hero-copy"><span className="hero-location">ENERGIA SOLAR EM NATAL E REGIÃO</span><h1>Reduza sua conta de luz com <em>energia solar.</em></h1><p>Simule sua geração e descubra uma estimativa de economia. A Modesto cuida do sombreamento, do projeto, da instalação e do acompanhamento.</p><div className="hero-actions"><a className="btn btn-primary hero-analysis-button" href="#simulador"><span>Quero minha análise grátis</span><svg className="hero-analysis-button__icon" viewBox="0 0 16 19" aria-hidden="true"><path d="M7 18C7 18.5523 7.44772 19 8 19C8.55228 19 9 18.5523 9 18H7ZM8.70711 0.292893C8.31658 -0.0976311 7.68342 -0.0976311 7.29289 0.292893L0.928932 6.65685C0.538408 7.04738 0.538408 7.68054 0.928932 8.07107C1.31946 8.46159 1.95262 8.46159 2.34315 8.07107L8 2.41421L13.6569 8.07107C14.0474 8.46159 14.6805 8.46159 15.0711 8.07107C15.4616 7.68054 15.4616 7.04738 15.0711 6.65685L8.70711 0.292893ZM9 18V1H7V18H9Z"/></svg></a><a className="hero-whatsapp" href={`https://wa.me/${PHONE}?text=${encodeURIComponent("Olá! Quero avaliar energia solar para meu imóvel.")}`} target="_blank" rel="noreferrer" onClick={()=>trackConversion("whatsapp_clicked","hero")}>Prefiro falar pelo WhatsApp</a></div><div className="hero-trust"><span><Icon name="check" size={15}/> Projeto sob medida</span><span><Icon name="check" size={15}/> Sem compromisso</span><span><Icon name="check" size={15}/> Opções de financiamento</span></div></div><SolarPanelModel/></div><a href="#simulador" className="scroll-hint"><span/> Role para descobrir</a></section>
      <section className="trust-strip"><div className="container trust-grid">{[["search","Análise completa","Antes de você decidir"],["pen","Projeto personalizado","Para o seu consumo"],["tool","Instalação segura","Do início ao fim"],["monitor","Geração monitorada","Na palma da sua mão"]].map(x=><div key={x[1]}><Icon name={x[0]}/><span><b>{x[1]}</b><small>{x[2]}</small></span></div>)}</div></section>
      <DeferredSection id="simulador" label="Simule a energia solar do seu imóvel"><Suspense fallback={<div className="section-load-message">Preparando sua simulação...</div>}><SolarConfigurator onSimulationChange={updateSolarSimulation} onRequestAnalysis={showGenerationAnalysis} onInvalidateAnalysis={hideGenerationAnalysis} analysisVisible={analysisVisible} vehicle={vehicle} onRemoveVehicle={removeVehicle} onStart={markSimulation} onContact={openContact}/></Suspense></DeferredSection>
      <DeferredSection id="mobilidade" label="Planeje a recarga do seu carro elétrico"><Suspense fallback={<div className="section-load-message">Preparando análise de recarga...</div>}><ElectricVehicleSection onInclude={includeVehicle} onEstimateChange={updateVehicle} onReset={removeVehicle}/></Suspense></DeferredSection>
      <section className="proof-strip" aria-label="Conheça a Modesto"><div className="container"><div><h2>Uma decisão com informação e confiança.</h2><p>Conheça a Modesto, converse com a equipe e peça referências de projetos antes de decidir. Sua proposta deve considerar as condições reais do imóvel.</p></div><div className="proof-links"><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">Conhecer a Modesto no Instagram ↗</a><a href={`https://wa.me/${PHONE}?text=${encodeURIComponent("Olá! Gostaria de conhecer referências de projetos da Modesto e avaliar meu imóvel.")}`} target="_blank" rel="noreferrer" onClick={()=>trackConversion("whatsapp_clicked","references")}>Pedir referências à equipe ↗</a></div></div></section>
      <section className="section metropolitan" id="mapa"><div className="container"><div className="metropolitan-heading"><div><span className="kicker">RADIAÇÃO SOLAR NA GRANDE NATAL</span><h2>Veja onde o sol revela <em>mais potencial.</em></h2></div><p>Conheça a disponibilidade solar em Natal e região. O mapa é uma referência regional: o potencial do seu telhado depende de orientação, inclinação e sombras.</p></div><div className="metropolitan-grid">{mapActive?<><MetropolitanMap weatherSelection={solarForecast} solarAtlas={solarAtlas}/><div className="metropolitan-copy"><SolarWeatherCard onForecastChange={setSolarForecast}/></div></>:<div className="map-preview"><Icon name="sun" size={40}/><h3>Qual o potencial solar da sua região?</h3><p>Explore as cidades e consulte os dados do Global Solar Atlas e a previsão meteorológica.</p><button className="btn btn-small" type="button" onClick={()=>setMapActive(true)}>Explorar mapa solar <Icon name="arrow" size={18}/></button><a href="#simulador">Prefiro simular meu imóvel</a></div>}</div></div></section>
      <section className="section faq" id="faq"><div className="container faq-grid"><div className="faq-intro"><span className="kicker">DÚVIDAS FREQUENTES</span><h2>Antes de decidir,<br/><em>é bom entender.</em></h2><p>Conheça cada etapa: análise do imóvel e do sombreamento, dimensionamento, financiamento, instalação, homologação e acompanhamento.</p><a href="#contato" className="text-link dark">Ainda tem dúvidas? Fale conosco <Icon name="arrow" size={16}/></a></div><div className="accordion">{faqs.map((x,i)=><div className={`faq-item ${faq===i?"active":""}`} key={x[0]}><button onClick={()=>setFaq(faq===i?-1:i)} aria-expanded={faq===i} aria-controls={`faq-answer-${i}`}><span>{x[0]}</span><b aria-hidden="true">{faq===i?"−":"+"}</b></button><div className="faq-answer" id={`faq-answer-${i}`}><div className="faq-answer-content"><p>{x[1]}</p>{x[2]&&<ol className="faq-process">{x[2].map((step,stepIndex)=><li key={step[0]}><i>{String(stepIndex+1).padStart(2,"0")}</i><span><strong>{step[0]}</strong><small>{step[1]}</small></span></li>)}</ol>}</div></div></div>)}</div></div></section>
      <section className="section news-section" id="solucoes"><div className="container news-heading"><div><span className="kicker">ENERGIA EM MOVIMENTO</span><h2>Notícias que iluminam<br/><em>novas possibilidades.</em></h2></div><p>Informação para acompanhar as mudanças do setor elétrico e entender por que produzir a própria energia faz cada vez mais sentido.</p></div><div className="news-marquee" tabIndex="0" aria-label="Carrossel de notícias sobre energia solar"><div className="news-track">{[...newsItems,...newsItems].map((item,i)=><a className="news-card" href={item.url} target="_blank" rel="noreferrer" key={`${item.url||item.image}-${i}`} aria-hidden={i>=newsItems.length} tabIndex={i>=newsItems.length?-1:0}><div className="news-image"><img src={item.image} alt={i<newsItems.length?item.title:""} loading="lazy" decoding="async" width="320" height="395" onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src=fallbackNewsItems[i%fallbackNewsItems.length].image}}/><span>{item.isFallback?"Leitura":"Notícia"}</span></div><div className="news-card__body"><small>{item.source}</small><h3>{item.title}</h3><div><span>Acessar fonte</span><Icon name="arrow" size={16}/></div></div></a>)}</div></div><div className="container news-footer"><span><i/> Informação para acompanhar o setor</span><small>Fontes identificadas · Deslize para explorar</small></div></section>
      <section className="contact" id="contato"><div className="container contact-grid"><div className="contact-copy"><span className="kicker light-kicker">COMECE AGORA</span><h2>Vamos avaliar <em>seu imóvel?</em></h2><p>Conte o que precisamos saber para avaliar seu projeto. Se você já simulou, aproveitamos sua configuração. Revise as respostas antes de enviar pelo WhatsApp.</p><div className="contact-note"><Icon name="shield"/><span><b>Análise inicial gratuita</b><small>Uma conversa rápida, sem compromisso e sem formulários complicados.</small></span></div><a className="contact-instagram" href={INSTAGRAM_URL} target="_blank" rel="noreferrer" aria-label="Instagram da Modesto Energias Renováveis">Instagram · @modesto_rn <Icon name="arrow" size={16}/></a></div><div className="chat-invite"><div className="chat-invite-icon"><Icon name="sun" size={30}/></div><span>Atendimento online</span><h3>Descubra o potencial de economia do seu imóvel.</h3><p>Leva apenas alguns minutos.</p><button className="btn btn-primary full" type="button" onClick={openContact}>Solicitar análise gratuita <Icon name="arrow" size={18}/></button><a className="contact-direct" href={`https://wa.me/${PHONE}`} target="_blank" rel="noreferrer" onClick={()=>trackConversion("whatsapp_clicked","contact_direct")}>Prefiro falar diretamente pelo WhatsApp</a></div></div></section>
    </main>
    {analysisVisible&&<GenerationAnalysis simulation={solarSimulation} onClose={hideGenerationAnalysis} onContact={openContact}/>} 
    {chatOpen&&<div ref={chatDialog} className="chat-modal" role="dialog" aria-modal="true" aria-label="Análise solar interativa" tabIndex="-1" onMouseDown={e=>e.target===e.currentTarget&&setChatOpen(false)}><div className="chat-modal-panel"><ChatAssistant onClose={()=>setChatOpen(false)} simulation={hasSimulation?solarSimulation:null} vehicle={vehicle} initialAnswers={{...(hasSimulation?{bill:String(solarSimulation.bill),segment:solarSimulation.property}:{}),...(vehicle?{electricVehicle:"Já possuo",evProfile:vehicle.usageProfile==="driver"?"Motorista de aplicativo":"Uso particular",evDailyKm:String(vehicle.dailyDistance)}:{})}}/></div></div>}
    <footer inert={chatOpen?true:undefined} aria-hidden={chatOpen}><div className="container footer-top"><Logo/><p>Energia solar em Natal e região. Análise, instalação e suporte para o seu projeto.</p><div className="footer-links"><a href="#solucoes">Notícias</a><a href="#contato">Contato</a><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@modesto_rn</a></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Modesto Energias Renováveis.</span><span>WhatsApp: +55 84 99231-5543</span></div></footer>
    <div className="whatsapp-float-wrap" inert={chatOpen?true:undefined} aria-hidden={chatOpen}><a className="Btn" onClick={()=>trackConversion("whatsapp_clicked","floating")} aria-label="Falar com a Modesto pelo WhatsApp" href={`https://wa.me/${PHONE}?text=${encodeURIComponent("Olá! Gostaria de saber mais sobre energia solar.")}`} target="_blank" rel="noreferrer"><span className="sign"><svg className="socialSvg whatsappSvg" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/></svg></span><span className="text">Whatsapp</span></a></div>
  </div>
}
